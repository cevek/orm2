type Ref = {to: Field; collection: boolean; through: Field | undefined};
type Field = {table: Table; tableName: string | undefined; name: string; ref: Ref | undefined};
type Table = {name: string; id: Field; fields: Map<string, Field>};
// declare const tableStructs: Map<string, Table>;
type Hash = {[key: string]: Hash};

function extractFields(
    table: Table,
    obj: Hash,
    tableName: string,
    subQueries: Map<
        string,
        {
            ref: Ref;
            parentFieldName: string;
            find: Find<unknown>;
        }
    >,
    tables: Map<string, {table: Table; a: Field; b: Field}>,
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
                    table,
                    a: createField(tableName, table.id.name, table),
                    b: createField(refTableName, field.ref.to.name, field.ref.to.table),
                });
                extractFields(
                    field.ref.to.table,
                    obj[key],
                    refTableName,
                    subQueries,
                    tables,
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

export function query(q: Find<unknown>) {
    q.where = q.where || [];
    const table = {} as Table;
    const tables = new Map<string, {table: Table; a: Field; b: Field}>();
    const subQueries = new Map<
        string,
        {
            ref: Ref;
            parentFieldName: string;
            find: Find<unknown>;
        }
    >();
    const selectFields = extractFields(table, q.select, '', subQueries, tables);
    // selectFields.push({key: table.id, value: 0, path: []});
    const conditions = q.where.map(where => extractFields(table, where, '', subQueries, tables));
    const orders = q.order ? extractFields(table, q.order, '', subQueries, tables) : undefined;

    const items: unknown[] = [];
    const itemIds = items.map(item => (item as {id: number}).id);
    const itemsMap = new Map<number, unknown>();
    for (const [, subQuery] of subQueries) {
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
        (subFind.select as {[key: string]: 0})[subQuery.ref.to.name] = 0;
        subFind.where = subFind.where || [];
        subFind.where.push({
            [subQuery.ref.to.name]: {
                in: itemIds,
            },
        });
        const subItems = query(subFind);
        for (const subItem of subItems) {
            const itemId = (subItem as {[key: string]: number})[subQuery.ref.to.name];
            const item = itemsMap.get(itemId) as {[key: string]: unknown[]};
            let arr = item[subQuery.parentFieldName];
            if (arr === undefined) {
                arr = [];
                item[subQuery.parentFieldName] = arr;
            }
            arr.push(subItem);
        }
    }
    const result = items.map(item => {
        const resultItem: Hash = {};
        for (const field of selectFields) {
            let dest = resultItem;
            let source = item as Hash;
            for (const part of field.path) {
                if (dest === undefined) {
                    dest = {};
                }
                if (source === undefined) break;
                const next = source[part];
                source = next;
                dest[part] = next;
            }
        }
        return resultItem as unknown;
    });
    return result;
}

function createField(tableName: string, name: string, table: Table, ref?: Ref): Field {
    return {table, tableName, name, ref};
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
