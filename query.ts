export type Ref = {from: Field; to: Field; collection: boolean; through: Field | undefined};
export type Field = {table: Table; tableName: string | undefined; name: string; ref: Ref | undefined};
export type Table = {name: string; id: Field; fields: Map<string, Field>};
// declare const tableStructs: Map<string, Table>;
type Hash = {[key: string]: Hash};
type SubQuery = {ref: Ref; parentFieldName: string; find: Find<unknown, unknown>};

export function query(table: Table, q: Find<unknown>, data: {[key: string]: any}) {
    q.where = q.where || [];
    const tables = new Map<string, {table: Table; a: Field; b: Field}>();
    const subQueries = new Map<string, SubQuery>();
    const selectFields = extractFields(table, q.select, subQueries, tables);
    const conditions = q.where.map(where => extractFields(table, where, subQueries, tables));
    const orders = q.order ? extractFields(table, q.order, subQueries, tables) : undefined;

    const sqlQuery = sql(
        'SELECT ',
        ...join<Field | string>(selectFields.map(field => field.key), ', '),
        ', ',
        table.id,
        ' FROM `',
        table.name,
        '` ',
        [...tables]
            .map(([name, join]) => sql('LEFT JOIN `', join.table.name, '` `', name, '` ON ', join.a, '=', join.b))
            .join(' '),
    );

    console.log({selectFields, conditions, orders, tables, subQueries, sqlQuery});

    const items: unknown[] = data[table.name];

    const itemIds = [];
    const itemsMap = new Map<number, unknown>();
    for (const item of items) {
        const id = (item as {id: number}).id;
        itemsMap.set(id, item);
        itemIds.push(id);
    }
    for (const [, subQuery] of subQueries) {
        selectSubQuery(subQuery, itemIds, itemsMap, data);
    }
    return prepareResult(items, selectFields);
}

function prepareResult(items: unknown[], selectFields: {key: Field; value: unknown; path: string[]}[]) {
    return items.map(item => {
        const resultItem: Hash = {};
        for (let k = 0; k < selectFields.length; k++) {
            const field = selectFields[k];
            let dest = resultItem;
            for (let i = 0; i < field.path.length - 1; i++) {
                // if (dest === undefined) dest = {};
                if (dest[field.path[i]] === undefined) {
                    dest[field.path[i]] = {};
                }
                dest = dest[field.path[i]];
                // if (dest === undefined) dest = {};
            }
            dest[field.path[field.path.length - 1]] = (item as Hash[])[k];
        }
        return resultItem as unknown;
    });
}

function selectSubQuery(
    subQuery: SubQuery,
    itemIds: number[],
    itemsMap: Map<number, unknown>,
    data: {[key: string]: any},
) {
    let subFind = subQuery.find;
    if (subQuery.ref.through !== undefined) {
        const subName = subQuery.ref.through.name;
        subFind = {
            select: {
                [subName]: subFind.select,
            },
            where: [
                {
                    [subName]: subFind.where,
                },
            ],
            selectCustom: {
                [subName]: subFind.selectCustom,
            },
            limit: subFind.limit,
            offset: subFind.offset,
            order: {
                [subName]: subFind.order,
            },
        };
        subQuery.ref.through;
    }
    (subFind.select as {
        [key: string]: 0;
    })[subQuery.ref.to.name] = 0;
    subFind.where = subFind.where || [];
    subFind.where.push({
        [subQuery.ref.to.name]: {
            in: itemIds,
        },
    });
    const subItems = query(subQuery.ref.to.table, subFind, data);
    for (const subItem of subItems) {
        const itemId = (subItem as {
            [key: string]: number;
        })[subQuery.ref.to.name];
        const item = itemsMap.get(itemId) as {
            [key: string]: unknown[];
        };
        let arr = item[subQuery.parentFieldName];
        if (arr === undefined) {
            arr = [];
            item[subQuery.parentFieldName] = arr;
        }
        arr.push(subItem);
    }
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
            s += `\`${arg.tableName}\`.\`${arg.name}\``;
        }
    }
    return s;
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
            const refTableName = tableName ? tableName + '_' + key : key;
            if (field.ref.collection) {
                subQueries.set('refTableName', {
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
