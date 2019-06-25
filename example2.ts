import {Table, createField, query} from './query.js';

export {};

const User: Table = {
    fields: new Map(),
    get id() {
        return this.fields.get('id')!;
    },
    name: 'User',
};

const Post: Table = {
    fields: new Map(),
    get id() {
        return this.fields.get('id')!;
    },
    name: 'Post',
};

const PostLike: Table = {
    fields: new Map(),
    get id() {
        return this.fields.get('id')!;
    },
    name: 'PostLike',
};

User.fields.set('id', createField(User.name, 'id', User));
User.fields.set('name', createField(User.name, 'name', User));

PostLike.fields.set('id', createField(PostLike.name, 'id', PostLike));
PostLike.fields.set('postId', createField(PostLike.name, 'postId', PostLike));
PostLike.fields.set('userId', createField(PostLike.name, 'userId', PostLike));
PostLike.fields.set(
    'user',
    createField(Post.name, 'user', Post, {
        collection: false,
        through: undefined,
        from: PostLike.fields.get('userId')!,
        to: User.fields.get('id')!,
    }),
);

Post.fields.set('id', createField(Post.name, 'id', Post));
Post.fields.set('title', createField(Post.name, 'title', Post));
Post.fields.set('authorId', createField(Post.name, 'authorId', Post));
Post.fields.set(
    'author',
    createField(Post.name, 'author', Post, {
        collection: false,
        through: undefined,
        from: Post.fields.get('authorId')!,
        to: User.fields.get('id')!,
    }),
);
Post.fields.set(
    'likes',
    createField(Post.name, 'likes', Post, {
        collection: true,
        through: undefined,
        from: Post.fields.get('id')!,
        to: PostLike.fields.get('postId')!,
    }),
);

const data = {PostLike: [['Vova', 2], ['Vasya', 2]], Post: [['Hello', 'Alex', 2]]};
const res = query(
    Post,
    {
        select: {
            title: 0,
            author: {name: 0},
            likes: {
                select: {
                    user: {
                        name: 0,
                    },
                },
            },
        },
        limit: 10,
        offset: 1,
        order: {
            author: {
                name: 'asc',
            },
        },
    },
    data,
);
console.log(res);
