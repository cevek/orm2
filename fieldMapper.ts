import {Find} from './types';

function createGraphQLMap<T extends {[P in keyof DB]?: any}, DB extends {[key: string]: Collection<any>}>(
    db: DB,
    obj: T,
) {
    return <K extends Extract<keyof T, keyof DB>>(name: K, fields: T[K]): DB[K]['type'] => {
        return null!;
    };
}

type ArrayKeys<T> = {[P in keyof T]: T[P] extends any[] ? P : never}[keyof T];
function is<A, B>(
    val: {
        [P in Extract<ArrayKeys<A>, keyof B>]: A[P] extends any[]
            ? B[P] extends {args: infer Args; result: (infer V)[]}
                ? ((args: Args) => Omit<Find<A[P][number]>, 'select' | 'selectCustom'>)
                : never
            : never
    },
): B {
    return null!;
}

interface Post {
    likes: User[];
}

interface User {}

const db = {
    users: createCollection<User>(),
    posts: createCollection<Post>(),
};

db.posts.find({select: {}});

const mapper = createGraphQLMap(db, {
    posts: is<Post, ApiPost>({
        likes: args => ({
            limit: args.limit,
            offset: 10,
        }),
    }),
});

mapper('posts', {
    title: '',
    likes: {
        args: {limit: 1},
        result: [
            {
                id: 1,
            },
        ],
    },
});

type ApiPost = {
    title: string;
    likes: {args: {limit: number}; result: ApiPostLike[]};
};
type ApiPostLike = {id: number};

type Collection<T> = {
    type: T;
    find: (params: Find<T>) => T;
};
function createCollection<T>(): Collection<T> {
    return null!;
}

export {};
