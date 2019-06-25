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

const PostComment: Table = {
    fields: new Map(),
    get id() {
        return this.fields.get('id')!;
    },
    name: 'PostComment',
};
const Comment: Table = {
    fields: new Map(),
    get id() {
        return this.fields.get('id')!;
    },
    name: 'Comment',
};

User.fields.set('id', createField(User.name, 'id', User));
User.fields.set('name', createField(User.name, 'name', User));

Comment.fields.set('id', createField(Comment.name, 'id', Comment));
Comment.fields.set('text', createField(Comment.name, 'text', Comment));
Comment.fields.set('userId', createField(Comment.name, 'userId', Comment));
Comment.fields.set(
    'user',
    createField(Comment.name, 'user', Comment, {
        collection: false,
        through: undefined,
        from: Comment.fields.get('userId')!,
        to: User.fields.get('id')!,
    }),
);

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

PostComment.fields.set('id', createField(PostComment.name, 'id', PostComment));
PostComment.fields.set('postId', createField(PostComment.name, 'postId', PostComment));
PostComment.fields.set('commentId', createField(PostComment.name, 'commentId', PostComment));
PostComment.fields.set(
    'comment',
    createField(PostComment.name, 'comment', PostComment, {
        collection: false,
        through: undefined,
        from: PostComment.fields.get('commentId')!,
        to: Comment.fields.get('id')!,
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
Post.fields.set(
    'comments',
    createField(Post.name, 'comments', Post, {
        collection: true,
        through: PostComment.fields.get('comment')!,
        from: Post.fields.get('id')!,
        to: PostComment.fields.get('postId')!,
    }),
);

const data = {
    Comment: [['Ivan', 2], ['John', 2]],
    PostLike: [['Vova', 2], ['Vasya', 2]],
    Post: [['Hello', 'Alex', 2]], 
};
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
                limit: 5,
            },
            comments: {
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
