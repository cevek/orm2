import {createDBSchemaFromTsFile} from './createSchema';
import {insert} from './insert';
import {query} from './query';
import {update} from './update';

export {};

// const User: Table = {
//     fields: new Map(),
//     get id() {
//         return this.fields.get('id')!;
//     },
//     name: 'User',
// };

// const Post: Table = {
//     fields: new Map(),
//     get id() {
//         return this.fields.get('id')!;
//     },
//     name: 'Post',
// };

// const PostLike: Table = {
//     fields: new Map(),
//     get id() {
//         return this.fields.get('id')!;
//     },
//     name: 'PostLike',
// };

// const PostComment: Table = {
//     fields: new Map(),
//     get id() {
//         return this.fields.get('id')!;
//     },
//     name: 'PostComment',
// };
// const Comment: Table = {
//     fields: new Map(),
//     get id() {
//         return this.fields.get('id')!;
//     },
//     name: 'Comment',
// };

// User.fields.set('id', createIdField(User));
// User.fields.set('name', createField(User.name, 'name', User));

// Comment.fields.set('id', createIdField(Comment));
// Comment.fields.set('text', createField(Comment.name, 'text', Comment));
// Comment.fields.set('userId', createRefField(Comment, 'userId', User));
// Comment.fields.set(
//     'user',
//     createField(Comment.name, 'user', Comment, {
//         collection: false,
//         through: undefined,
//         from: Comment.fields.get('userId')!,
//         to: User.fields.get('id')!,
//     }),
// );
// Comment.fields.get('userId')!.edge = Comment.fields.get('user');

// PostLike.fields.set('id', createIdField(PostLike));
// PostLike.fields.set('postId', createRefField(PostLike, 'postId', Post));
// PostLike.fields.set('userId', createRefField(PostLike, 'userId', User));
// PostLike.fields.set(
//     'user',
//     createField(Post.name, 'user', Post, {
//         collection: false,
//         through: undefined,
//         from: PostLike.fields.get('userId')!,
//         to: User.fields.get('id')!,
//     }),
// );
// PostLike.fields.get('userId')!.edge = PostLike.fields.get('user');

// PostComment.fields.set('id', createIdField(PostComment));
// PostComment.fields.set('postId', createRefField(PostComment, 'postId', Post));
// PostComment.fields.set('commentId', createRefField(PostComment, 'commentId', Comment));
// PostComment.fields.set(
//     'comment',
//     createField(PostComment.name, 'comment', PostComment, {
//         collection: false,
//         through: undefined,
//         from: PostComment.fields.get('commentId')!,
//         to: Comment.fields.get('id')!,
//     }),
// );
// PostComment.fields.get('commentId')!.edge = PostComment.fields.get('comment');

// Post.fields.set('id', createIdField(Post));
// Post.fields.set('title', createField(Post.name, 'title', Post));
// Post.fields.set('authorId', createRefField(Post, 'authorId', User));
// Post.fields.set(
//     'author',
//     createField(Post.name, 'author', Post, {
//         collection: false,
//         through: undefined,
//         from: Post.fields.get('authorId')!,
//         to: User.fields.get('id')!,
//     }),
// );
// Post.fields.get('authorId')!.edge = Post.fields.get('author');

// Post.fields.set(
//     'likes',
//     createField(Post.name, 'likes', Post, {
//         collection: true,
//         through: undefined,
//         from: Post.fields.get('id')!,
//         to: PostLike.fields.get('postId')!,
//     }),
// );
// Post.fields.set(
//     'comments',
//     createField(Post.name, 'comments', Post, {
//         collection: true,
//         through: PostComment.fields.get('comment')!,
//         from: Post.fields.get('id')!,
//         to: PostComment.fields.get('postId')!,
//     }),
// );

const tsFile = require.resolve('./exampleSchema.d.ts');
const tables = createDBSchemaFromTsFile(tsFile);
// console.dir(res);

const Post = tables.get('Post')!;

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
                where: {
                    AND: [
                        {
                            OR: [
                                {
                                    user: {
                                        name: 'a',
                                    },
                                },
                                {
                                    user: {
                                        name: 'b',
                                    },
                                },
                            ],
                        },
                        {
                            OR: [
                                {
                                    user: {
                                        name: 'x',
                                    },
                                },
                                {
                                    user: {
                                        name: 'y',
                                    },
                                },
                            ],
                        },
                    ],
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

insert(Post, [
    {
        title: 'Hello',
        authorId: 'auto',
        author: {
            name: 'Alex',
        },
        likes: [{postId: 'auto', userId: 'auto', user: {name: 'Vova'}}],
        comments: [{userId: 'auto', text: 'Hey', user: {name: 'Slava'}}],
    },
]);

update(Post, {
    id: 1,
    title: 'Hello',
    author: {
        name: 'Alex',
    },
    likes: {
        create: [{postId: 'auto', userId: 'auto', user: {name: 'Vova'}}],
        update: [{id: 11, user: {name: 'Sergio'}}],
        remove: [{id: 10}],
    },
    comments: {
        create: [{text: 'Hey', userId: 'auto', user: {name: 'Slava'}}],
        update: [{id: 111, text: 'Wow', user: {name: 'Steven'}}],
        remove: [{id: 110}],
    },
});

// (author.name === "a" || author.email === "a") && author.lastName === 'y'
