import {dbField, sql} from './sqlGenerator';
import {DBRaw, QueryFun} from './types';
import {Exception, ClientException} from './utils';

export class Collection<T> {
    name: DBRaw;
    fields: {[P in keyof T]: DBRaw};
    constructor(public collectionName: string, private query: QueryFun) {
        this.name = dbField(collectionName);
        this.fields = new Proxy({} as this['fields'], {
            get: (_, key: string) => sql`${this.name}.${dbField(key)}`,
        });
    }
    async findById() {
        const row = await this.findByIdOrNull();
        if (row === null) throw new Exception('EntityNotFound', {collection: this.collectionName});
        return row;
    }
    async findByIdClient() {
        const row = await this.findByIdOrNull();
        if (row === null) throw new ClientException('EntityNotFound', {collection: this.collectionName});
        return row;
    }
    async findOne() {
        const row = await this.findOneOrNull();
        if (row === null) throw new Exception('EntityNotFound', {collection: this.collectionName});
        return row;
    }
    async findOneClient() {
        const row = await this.findOneOrNull();
        if (row === null) throw new ClientException('EntityNotFound', {collection: this.collectionName});
        return row;
    }
    async findAll() {
        return this.query(sql``);
    }
    async findByIdOrNull() {
        return this.findOneOrNull();
    }
    async findOneOrNull() {
        const rows = await this.findAll();
        return rows.length > 0 ? rows[0] : null;
    }
    async update() {}
    async remove() {}
    async create() {}
}
