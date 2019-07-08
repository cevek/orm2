export type QueryValue = DBValue | DBRaw | DBQuery | DBQueries;
export type QueryFun = <T>(query: DBQuery) => Promise<T[]>;

export class DBRaw {
    constructor(public readonly raw: string) {}
}

export class DBQuery {
    constructor(public readonly parts: ReadonlyArray<string>, public readonly values: ReadonlyArray<QueryValue>) {}
}

export class DBQueries {
    constructor(public readonly queries: ReadonlyArray<DBQuery>, public readonly separator: DBQuery | undefined) {}
}

declare class OpaqueType<Name> {
    private type: Name;
}
export type Id<Name extends string> = OpaqueType<Name> & number;
type Primitive = OpaqueType<any> | Date | number | string | boolean | null | undefined | symbol;

type KeysWithObjects<T> = {[P in keyof T]: T[P] extends Primitive ? never : P}[keyof T];
type KeysWithoutObjects<T> = {[P in keyof T]: T[P] extends Primitive ? P : never}[keyof T];

type IfEquals<X, Y, A = X, B = never> = (<T>() => T extends X ? 1 : 2) extends (<T>() => T extends Y ? 1 : 2) ? A : B;
type WritableKeys<T> = {[P in keyof T]-?: IfEquals<{[Q in P]: T[P]}, {-readonly [Q in P]: T[P]}, P>}[keyof T];
type ReadonlyKeys<T> = {[P in keyof T]-?: IfEquals<{[Q in P]: T[P]}, {-readonly [Q in P]: T[P]}, never, P>}[keyof T];

export type Create<
    T,
    K1 extends keyof T = Exclude<KeysWithoutObjects<T>, ReadonlyKeys<T>>,
    K2 extends keyof T = Exclude<KeysWithObjects<T>, ReadonlyKeys<T>>
> = T extends Primitive
    ? T
    : T extends any[]
    ? {[P in keyof T]: Create<T[number]>}
    : ({[P in K1]: Create<T[P]>} & {[P in K2]?: Create<T[P]>});

export type Update<T, K extends keyof T = Exclude<keyof T, 'id' | ReadonlyKeys<T>>> = T extends Primitive
    ? T
    : T extends any[]
    ? {
          create?: Create<T[number]>[];
          update?: (Update<T[number]> & PickId<T[number]>)[];
          delete?: PickId<T[number]>[];
      }
    : {[P in K]?: Update<T[P]>};
export type PickId<T> = T extends {id: any} ? {id: T['id']} : unknown;

export type Find<T, SelectT = T> = {
    select: Select<SelectT>;
    where?: Filter<T>;
    order?: Sort<T>;
    limit?: number;
    offset?: number;
};

type GQLFind<T> = {
    filter?: Filter<T>;
    sort?: Sort<T>;
    limit?: number;
    offset?: number;
};

export type SelectConstraint<T, Entity> = {
    [P in keyof T]: P extends keyof Entity
        ? (Entity[P] extends Primitive
              ? any
              : (Entity[P] extends any[] ? SelectConstraintArray<T[P], Entity[P]> : SelectConstraint<T[P], Entity[P]>))
        : never
};
type SelectConstraintArray<T, Entity> = Entity extends any[]
    ? T extends {select: any}
        ? Find<Entity[number], SelectConstraint<T['select'], Entity[number]>>
        : never
    : never;

export type SelectResult<T, Entity> = SelectResultK<T, Entity, Extract<keyof Entity, keyof T>>;
type SelectResultK<T, Entity, K extends keyof Entity> = {
    [P in K]-?: Entity[P] extends Primitive
        ? Entity[P]
        : Entity[P] extends any[]
        ? SelectResultArr<P extends keyof T ? T[P] : never, Entity[P]>
        : SelectResult<P extends keyof T ? T[P] : never, Entity[P]>
};

type SelectResultArr<T, Entity> = {
    [P in keyof Entity]: SelectResult<T extends {select: any} ? T['select'] : never, Entity[P]>
};
type Select<T> = {
    [P in keyof T]?: T[P] extends Primitive ? any : T[P] extends any[] ? Find<T[P][number]> : Select<T[P]>
};

type Sort<T> = {[P in keyof T]?: T[P] extends Primitive ? 'asc' | 'desc' : T[P] extends any[] ? never : Sort<T[P]>};

type NonUndefined<T> = T extends undefined ? never : T;

export type DBValue = DBValueBase | DBValueBase[];
export type DBValueBase = string | number | boolean | Date | undefined | null;

type Filter<T> = {
    [P in keyof T]?: T[P] extends (Date | undefined)
        ? TransformOperator<DateOperators, NonUndefined<T[P]>>
        : T[P] extends (string | undefined)
        ? TransformOperator<StringOperators, NonUndefined<T[P]>>
        : T[P] extends (number | undefined)
        ? TransformOperator<NumberOperators, NonUndefined<T[P]>>
        : T[P] extends (boolean | undefined)
        ? TransformOperator<BooleanOperators, NonUndefined<T[P]>>
        : T[P] extends any[]
        ? never
        : Filter<T[P]>
} & {OR?: Filter<T>[]; AND?: Filter<T>[]};

// type GQLFilter<T> = {
//     [P in keyof T]?: T[P] extends (Date | undefined)
//         ? DateOperators
//         : T[P] extends (string | undefined)
//         ? StringOperators
//         : T[P] extends (number | undefined)
//         ? NumberOperators
//         : T[P] extends (boolean | undefined)
//         ? BooleanOperators
//         : GQLFilter<T[P]>
// };

type TransformOperator<Op, T> =
    | {[P in keyof Op]: Op[P] extends (any[] | undefined) ? TransformOperator<Op[P], T> : (T | DBQuery)}
    | T;

export type AllOperators = NumberOperators & StringOperators & BooleanOperators & DateOperators;

type NumberOperators = {
    eq?: number;
    ne?: number;
    gt?: number;
    gte?: number;
    lt?: number;
    lte?: number;
    between?: [number, number];
    notBetween?: [number, number];
    in?: number[];
    notIn?: number[];
};

type DateOperators = {
    eq?: Date;
    ne?: Date;
    gt?: Date;
    gte?: Date;
    lt?: Date;
    lte?: Date;
    between?: [Date, Date];
    notBetween?: [Date, Date];
};

type BooleanOperators = {
    eq?: boolean;
    ne?: boolean;
};

type StringOperators = {
    eq?: string;
    in?: string[];
    ne?: string;
    gt?: string;
    gte?: string;
    lt?: string;
    lte?: string;
    like?: string;
    notLike?: string;
    iLike?: string;
    notILike?: string;
    regexp?: string;
    notRegexp?: string;
    iRegexp?: string;
    notIRegexp?: string;
};
