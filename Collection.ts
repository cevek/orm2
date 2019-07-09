import {insert} from './insert';
import {find, Table} from './query';
import {remove} from './remove';
import {dbField} from './sqlGenerator';
import {Create, DBQuery, DBRaw, Find, PickId, QueryFun, SelectConstraint, SelectResult, Update, Trx} from './types';
import {update} from './update';
import {Exception} from './utils';

type FindQuery<T, CustomFields, Fields> = (Find<T> & {customFields?: CustomFields}) | {select: Fields};
export class Collection<T> {
    name: DBRaw;
    constructor(
        public collectionName: string,
        private table: Table,
        private query: QueryFun,
        private transaction?: Trx,
    ) {
        this.name = dbField(collectionName);
    }
    async findOne<Fields extends SelectConstraint<Fields, T>, CustomFields extends {[key: string]: DBQuery}>(
        data: FindQuery<T, CustomFields, Fields>,
    ) {
        const row = await this.findOneOrNull(data);
        if (row === null) throw new Exception('EntityNotFound', {collection: this.collectionName});
        return row;
    }
    async findAll<Fields extends SelectConstraint<Fields, T>, CustomFields extends {[key: string]: DBQuery}>(
        data: FindQuery<T, CustomFields, Fields>,
    ) {
        const {result} = (await find(this.query, this.table, data as {select: any})) as {
            result: (SelectResult<Fields, T> & {[P in keyof CustomFields]: string | null})[];
        };
        return result;
    }
    async findOneOrNull<Fields extends SelectConstraint<Fields, T>, CustomFields extends {[key: string]: DBQuery}>(
        data: FindQuery<T, CustomFields, Fields>,
    ) {
        const rows = await this.findAll(data);
        return rows.length > 0 ? rows[0] : null;
    }
    async update(data: Update<T> & PickId<T>) {
        if (this.transaction !== undefined) {
            return this.transaction(() => update(this.query, this.table, data as {}));
        }
        return update(this.query, this.table, data as {});
    }
    async remove(data: PickId<T>) {
        return remove(this.query, this.table, data as {});
    }
    async create(data: Create<T>, params?: {noErrorIfConflict?: DBRaw | boolean}) {
        if (this.transaction !== undefined) {
            return this.transaction(() => insert(this.query, this.table, [data as {}], params));
        }
        return insert(this.query, this.table, [data as {}], params);
    }
}
