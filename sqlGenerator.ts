import {DBRaw} from './query';
import {DBQuery, QueryValue, DBQueries} from './types';
import {Exception} from './utils';

export function sqlGenerator(dbQuery: DBQuery, allValues: QueryValue[]) {
    let queryStr = '';
    const {parts, values} = (dbQuery as unknown) as DBQuery;
    for (let i = 0; i < parts.length; i++) {
        queryStr = queryStr + parts[i];
        if (values.length > i) {
            const value = values[i];
            if (value instanceof DBRaw) {
                queryStr = queryStr + value.raw;
            } else if (value instanceof DBQuery) {
                queryStr = queryStr + sqlGenerator(value, allValues);
            } else if (value instanceof DBQueries) {
                for (let j = 0; j < value.queries.length; j++) {
                    const subQuery = value.queries[j];
                    if (j > 0 && value.separator !== undefined) {
                        queryStr = queryStr + sqlGenerator(value.separator, allValues);
                    }
                    queryStr = queryStr + sqlGenerator(subQuery, allValues);
                }
            } else {
                allValues.push(value);
                queryStr = queryStr + '$' + String(allValues.length);
            }
        }
    }
    return queryStr;
}
export function sql(strs: TemplateStringsArray, ...inserts: QueryValue[]) {
    return new DBQuery(strs, inserts);
}

export function joinQueries(queries: DBQuery[], separator?: DBQuery): DBQuery {
    return sql`${new DBQueries(queries, separator)}`;
}

export function dbField(field: string) {
    if (!/^[a-z_][a-z\d$_\-]+$/i.test(field))
        throw new Exception(`Field name contains unacceptable characters`, {field});
    return new DBRaw(`"${field}"`);
}
