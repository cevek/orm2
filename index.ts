type KeysWithObjects<T> = {[P in keyof T]: T[P] extends object ? (T[P] extends Date ? never : P) : never}[keyof T];
type KeysWithoutObjects<T> = {[P in keyof T]: T[P] extends object ? (T[P] extends Date ? P : never) : P}[keyof T];

type IfEquals<X, Y, A = X, B = never> = (<T>() => T extends X ? 1 : 2) extends (<T>() => T extends Y ? 1 : 2) ? A : B;
type WritableKeys<T> = {[P in keyof T]-?: IfEquals<{[Q in P]: T[P]}, {-readonly [Q in P]: T[P]}, P>}[keyof T];
type ReadonlyKeys<T> = {[P in keyof T]-?: IfEquals<{[Q in P]: T[P]}, {-readonly [Q in P]: T[P]}, never, P>}[keyof T];

type Create<
    T,
    K1 extends keyof T = Exclude<KeysWithoutObjects<T>, ReadonlyKeys<T>>,
    K2 extends keyof T = Exclude<KeysWithObjects<T>, ReadonlyKeys<T>>
> = T extends object
    ? T extends Array<any>
        ? {[P in keyof T]: Create<T[number]>}
        : T extends Date
        ? Date
        : ({[P in K1]: Create<T[P]>} & {[P in K2]?: Create<T[P]>})
    : T;

type Update<T, K extends keyof T = Exclude<keyof T, 'id' | ReadonlyKeys<T>>> = T extends object
    ? T extends any[]
        ? {
              create?: Create<T[number]>[];
              update?: (Update<T[number]> & Id<T[number]>)[];
              delete?: Id<T[number]>[];
          }
        : T extends Date
        ? Date
        : {[P in K]?: Update<T[P]>}
    : T;
type Id<T> = T extends {id: any} ? {id: T['id']} : unknown;

type Find<T> = {
    select: Select<T>;
    filter?: Filter<T>;
    filters?: Filter<T>[];
    sort?: Sort<T>;
    limit?: number;
    limitFrom?: number;
};

type SelectConstraint<T, Entity> = {
    [P in keyof T]: P extends keyof Entity
        ? (T[P] extends object ? (T[P] extends Date ? Date : SelectConstraint<T[P], Entity[P]>) : any)
        : never
};
type SelectResult<T, Entity, K extends keyof Entity = Extract<keyof Entity, keyof T>> = {
    [P in K]: Entity[P] extends object
        ? Entity[P] extends Date
            ? Date
            : Entity[P] extends any[]
            ? SelectResultArr<P extends keyof T ? T[P] : never, Entity[P]>
            : SelectResult<P extends keyof T ? T[P] : never, Entity[P]>
        : Entity[P]
};
type SelectResultArr<T, Entity> = {[P in keyof Entity]: SelectResult<T extends any[] ? T[number] : never, Entity[P]>};
type Select<T> = {[P in keyof T]?: T[P] extends object ? (T[P] extends Date ? Date : Select<T[P]>) : 0};
type Sort<T> = {[P in keyof T]?: T[P] extends object ? Sort<T[P]> : 'asc' | 'desc'};

type Filter<T> = {
    [P in keyof T]?: T[P] extends object
        ? T[P] extends Date
            ? DateOperators
            : Filter<T[P]>
        : T[P] extends string
        ? StringOperators
        : T[P] extends number
        ? NumberOperators
        : T[P] extends boolean
        ? BooleanOperators
        : {}
};
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
