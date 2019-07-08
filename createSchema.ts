import {getTypesFromTsFile, Interface, Prop, Type} from 'ts-type-ast';
import {Field, Table} from './query';

// const tsFile = require.resolve('./exampleSchema.d.ts');
// const res = createDBSchemaFromTsFile(tsFile);
// console.dir(res);

export function createDBSchemaFromTsFile(tsFile: string) {
    const types = getTypesFromTsFile(tsFile);
    // const ids = ;
    const tables = new Map<string, Table>();
    const typeTable = new Map<Interface, Table>();
    const idFieldTable = new Map<Field, Table>();

    for (const type of types) {
        if (type.kind === 'interface' && type.name !== undefined) {
            if (!isIdType(type)) {
                const table: Table = {
                    fields: new Map(),
                    id: undefined!,
                    name: type.name,
                };
                const idProp = type.members.find(prop => prop.name === 'id');
                if (idProp === undefined) throw new Error(`Table ${table.name} should have "id" field`);
                const idField = createField(table, idProp);
                idField.idOf = table;
                table.id = idField;
                typeTable.set(type, table);
                tables.set(table.name, table);
                idFieldTable.set(idField, table);
            }
        }
    }
    const edges: Field[] = [];
    for (const [type, table] of typeTable) {
        for (const member of type.members) {
            const field = member.name === 'id' ? table.id : createField(table, member);
            field.idOf = idFieldTable.get(field);
            if (
                field.idOf === undefined &&
                !isIdType(member.type) &&
                (member.type.kind === 'interface' || member.type.kind === 'array')
            ) {
                edges.push(field);
            }
            table.fields.set(member.name, field);
        }
    }

    for (const field of edges) {
        if (field.type.type.kind === 'array') {
            const m = field.type.sourceType.match(/^([\w_]+)\['([\w_\-]+)'\]\[\]$/);
            let toTable;
            let toTableName;
            if (m !== null) {
                const throughTable = m[1];
                toTableName = throughTable;
                toTable = tables.get(toTableName);
            } else {
                toTableName = field.type.type.members.name;
                toTable = typeTable.get(field.type.type.members as Interface);
            }
            if (toTable === undefined) {
                throw new Error(`Field ${field.table.name}.${field.name} refers to non exists table ${toTableName}`);
            }
            let throughField;
            if (m !== null) {
                const throughFieldName = m[2];
                throughField = toTable.fields.get(throughFieldName);
                if (throughField === undefined)
                    throw new Error(`Field ${toTable.name}.${throughFieldName} is not found`);
            }

            let to;
            for (const [, toTableField] of toTable.fields) {
                if (toTableField.type.type === field.table.id.type.type) {
                    if (to !== undefined) {
                        throw new Error(
                            `Table ${toTable.name} has multiple fields with ${toTableField.type.type.name} type`,
                        );
                    }
                    to = toTableField;
                }
            }
            if (to === undefined) {
                throw new Error(
                    `Field ${field.table.name}.${field.name} doesn't have back reference id field from ${toTableName}`,
                );
            }
            field.ref = {
                from: field.table.id,
                to: to,
                through: throughField,
                collection: true,
            };
        } else {
            const from = field.table.fields.get(field.name + 'Id');
            if (from === undefined) {
                throw new Error(`Field ${field.table.name}.${field.name} has no companion ${field.name + 'Id'} field`);
            }

            if (field.type.type.kind !== 'interface') throw new Error('Something went wrong');
            const to = typeTable.get(field.type.type);
            if (to === undefined) {
                throw new Error(
                    `Field ${field.table.name}.${field.name} refers to non exists table ${field.type.name}`,
                );
            }
            from.edge = field;
            field.ref = {
                from: from,
                to: to.id,
                through: undefined,
                collection: false,
            };
        }
    }
    return tables;
}

function isIdType(type: Type) {
    return type.kind === 'interface' && type.name !== undefined && type.name.endsWith('Id');
}

function createField(table: Table, member: Prop) {
    const field: Field = {
        name: member.name,
        readonly: member.readonly,
        table: table,
        nullable: member.hasNull,
        tableName: table.name,
        hasDefault: member.hasUndefined,
        idOf: undefined,
        edge: undefined,
        ref: undefined,
        type: member,
    };
    return field;
}
