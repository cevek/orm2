import {getTypesFromTsFile, Type, Interface, ArrayType, Prop} from 'ts-type-ast';
import {Table, Field} from './query';

const tsFile = require.resolve('./exampleSchema.d.ts');
const types = getTypesFromTsFile(tsFile);

// const ids = ;
const tables = new Map<string, {}>();
const typeTable = new Map<Interface, Table>();
const idFieldTable = new Map<Field, Table>();

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
        type: member.type,
    };
    return field;
}

for (const type of types) {
    if (type.kind === 'interface' && type.name !== undefined) {
        if (type.name.endsWith('Id')) {
        } else {
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
    if (field.type.kind === 'array') {
        const destType = field.type.members;
        if (destType.kind !== 'interface') {
            throw new Error(`Field ${field.table.name}.${field.name} refers to non exists table ${destType.name}`);
        }
        const toTable = typeTable.get(destType);
        if (toTable === undefined) {
            throw new Error(`Field ${field.table.name}.${field.name} refers to non exists table ${destType.name}`);
        }
        let to;
        for (const [, field] of toTable.fields) {
            if (field.type === field.table.id.type) {
                to = field;
                break;
            }
        }
        if (to === undefined) {
            throw new Error(
                `Field ${field.table.name}.${field.name} doesn't have back reference id field from ${destType.name}`,
            );
        }
        field.ref = {
            from: field.table.id,
            to: to,
            through: undefined,
            collection: true,
        };
    } else {
        const from = field.table.fields.get(field.name + 'Id');
        if (from === undefined) {
            throw new Error(`Field ${field.table.name}.${field.name} has no companion ${field.name + 'Id'} field`);
        }

        if (field.type.kind !== 'interface') throw new Error('Something went wrong');
        const to = typeTable.get(field.type);
        if (to === undefined) {
            throw new Error(`Field ${field.table.name}.${field.name} refers to non exists table ${field.type.name}`);
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

console.dir(types, {depth: 10});
