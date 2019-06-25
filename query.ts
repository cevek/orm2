import {reservedSQLWords} from './reserved.js';

export type Ref = {from: Field; to: Field; collection: boolean; through: Field | undefined};
export type Field = {table: Table; tableName: string; name: string; ref: Ref | undefined};
export type Table = {name: string; id: Field; fields: Map<string, Field>};
// declare const tableStructs: Map<string, Table>;
type Hash = {[key: string]: Hash};
type SubQuery = {ref: Ref; parentFieldName: string; find: Find<unknown, unknown>};
type ParentList = {
    ref: Ref;
    map: Map<number, {[key: string]: unknown[]}>;
    field: string;
    ids: number[];
};

export function query(table: Table, q: Find<unknown>, data: {[key: string]: any}, parent?: ParentList) {
    q.where = q.where || [];
    const tables = new Map<string, {table: Table; a: Field; b: Field}>();
    const subQueries = new Map<string, SubQuery>();
    const selectFields = extractFields(table, q.select, subQueries, tables);
    const conditions = q.where.map(where => extractFields(table, where, subQueries, tables));
    const orders = q.order ? extractFields(table, q.order, subQueries, tables) : [];

    let parentIdFieldIdx = -1;
    if (parent !== undefined) {
        parentIdFieldIdx = selectFields.length;
        selectFields.push({key: parent.ref.to, value: 'skip', path: [parent.ref.to.name]});
        const inIds = {key: parent.ref.to, value: {in: parent.ids}, path: [parent.ref.to.name]};
        if (conditions.length === 0) {
            conditions.push([inIds]);
        } else {
            conditions.forEach(cond => {
                cond.push(inIds);
            });
        }
    }

    let idFieldIdx = -1;
    if (subQueries.size > 0) {
        idFieldIdx = selectFields.length;
        selectFields.push({key: table.id, value: 'skip', path: [table.id.name]});
    }

    const sqlQuery = sql(
        'SELECT ',
        ...join<Field | string>(selectFields.map(field => field.key), ', '),
        ' FROM ',
        escapeName(table.name),
        ...(parent !== undefined && parent.ref.through !== undefined
            ? [
                  ' RIGHT JOIN ',
                  escapeName(parent.ref.to.table.name),
                  ' ON ',
                  table.id,
                  '=',
                  parent.ref.through.ref!.from,
              ]
            : []),
        [...tables]
            .map(([name, join]) =>
                sql(' LEFT JOIN ', escapeName(join.table.name), ' ', escapeName(name), ' ON ', join.a, '=', join.b),
            )
            .join(' '),
        ...(conditions.length > 0
            ? [
                  ' WHERE ',
                  ...join<Field | string>(
                      conditions.map(cond => sql(...join<Field | string>(cond.map(c => c.key), ' AND '))),
                      ' OR ',
                  ),
              ]
            : []),
        ...(orders.length > 0
            ? [
                  ' ORDER ',
                  ...join<Field | string>(
                      orders.map(order => sql(order.key, ' ', order.value === 'desc' ? 'DESC' : 'ASC')),
                      ' ',
                  ),
              ]
            : []),
        ...(q.limit !== undefined ? [' LIMIT ', String(q.limit)] : []),
        ...(q.offset !== undefined ? [' OFFSET ', String(q.offset)] : []),
    );

    console.log({selectFields, conditions, orders, tables, subQueries, sqlQuery});

    const rawItems: unknown[][] = data[table.name];

    const itemsMap = new Map<number, {[key: string]: unknown[]}>();
    const result = rawItems.map(item => {
        const id = item[idFieldIdx] as number;
        const resultItem = {};
        itemsMap.set(id, resultItem);
        for (let k = 0; k < selectFields.length; k++) {
            const field = selectFields[k];
            if (field.value === 'skip') continue;
            let dest = resultItem as Hash;
            for (let i = 0; i < field.path.length - 1; i++) {
                const part = field.path[i];
                let d = dest[part];
                if (d === undefined) {
                    d = {};
                    dest[part] = d;
                }
                dest = d;
            }
            dest[field.path[field.path.length - 1]] = item[k] as Hash;
        }
        return resultItem as unknown;
    });
    if (subQueries.size > 0) {
        const itemIds = [...itemsMap.keys()];
        for (const [, subQuery] of subQueries) {
            const parent: ParentList = {
                ids: itemIds,
                field: subQuery.parentFieldName,
                map: itemsMap,
                ref: subQuery.ref,
            };
            query(
                subQuery.ref.through ? subQuery.ref.through.ref!.to.table : subQuery.ref.to.table,
                subQuery.find,
                data,
                parent,
            );
        }
    }

    if (parent !== undefined) {
        for (let i = 0; i < result.length; i++) {
            const item = result[i];
            const rawItem = rawItems[i];
            const itemId = rawItem[parentIdFieldIdx] as number;
            const parentItem = parent.map.get(itemId)!;
            let arr = parentItem[parent.field];
            if (arr === undefined) {
                arr = [];
                parentItem[parent.field] = arr;
            }
            arr.push(item);
        }
    }
    return {result, rawItems};
}

export function createField(tableName: string, name: string, table: Table, ref?: Ref): Field {
    return {table, tableName, name, ref};
}

function sql(...args: (Field | string)[]) {
    let s = '';
    for (const arg of args) {
        if (typeof arg === 'string') {
            s += arg;
        } else {
            s += `${escapeName(arg.tableName)}.${escapeName(arg.name)}`;
        }
    }
    return s;
}

function escapeName(name: string) {
    // if (reservedSQLWords.has(name.toUpperCase())) {
    return '"' + name + '"';
    // }
    // return name;
}

function extractFields(
    table: Table,
    obj: Hash,
    subQueries: Map<
        string,
        {
            ref: Ref;
            parentFieldName: string;
            find: Find<unknown>;
        }
    >,
    tables: Map<string, {table: Table; a: Field; b: Field}>,
    tableName: string = table.name,
    path: string[] = [],
    keyValues: {key: Field; value: unknown; path: string[]}[] = [],
) {
    for (const key in obj) {
        const field = table.fields.get(key);
        if (field === undefined) throw new Error(`${key} doesn't exists in ${table.name}`);
        if (field.ref) {
            const refTableName = tableName ? tableName + '.' + key : key;
            if (field.ref.collection) {
                subQueries.set(refTableName, {
                    ref: field.ref,
                    parentFieldName: key,
                    find: (obj[key] as {}) as Find<unknown>,
                });
            } else {
                tables.set(refTableName, {
                    table: field.ref.to.table,
                    a: createField(tableName, field.ref.from.name, table),
                    b: createField(refTableName, field.ref.to.name, field.ref.to.table),
                });
                extractFields(
                    field.ref.to.table,
                    obj[key],
                    subQueries,
                    tables,
                    refTableName,
                    [...path, key],
                    keyValues,
                );
            }
        } else {
            keyValues.push({key: createField(tableName, field.name, table), value: obj[key], path: [...path, key]});
        }
    }
    return keyValues;
}

function join<T>(arr: T[], separator: T): T[] {
    const res: T[] = [];
    for (let i = 0; i < arr.length; i++) {
        if (i < arr.length - 1) {
            res.push(arr[i], separator);
        } else {
            res.push(arr[i]);
        }
    }
    return res;
}

/**
 * 
select id, title, user.id, user.name 
from posts 
    left join users on (authorId = users.id) 
    left join postStat on (postStatId = postStat.id) 
where id = 1 and title = 'x' and postStat.views > 100 
order postState.views asc
===
posts[id] = {title: data[0], stat: {views: data[1]}, author: {name: data[2]}, comments: []};
 * 
 *
select postComments.postId, comment.text, user.name
from postsComments 
    left join comments on (comments.id = postsComments.id)
    left join users on (comment.authorId = users.id) 
where postsComments.postId in (postIds)
order users.name asc
====
comments[id] = {text, author: {name}};
posts[postId].comments.push(comments[id]) 
 * 
 * 
 */

/**

tables: Map<Path, {name: Field; a: Field; b: Field}>;


 
 * 
  */
