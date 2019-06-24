import {Table, createField, query} from './query.js';

export {};

const Post: Table = {
    fields: new Map(),
    id: undefined!,
    name: 'posts',
};

const User: Table = {
    fields: new Map(),
    id: undefined!,
    name: 'users',
};

const userId = createField(User.name, 'id', User);
const userName = createField(User.name, 'name', User);
User.id = userId;
User.fields.set('id', userId);
User.fields.set('name', userName);

const postId = createField(Post.name, 'id', Post);
const postTitle = createField(Post.name, 'title', Post);
const postAuthorId = createField(Post.name, 'authorId', Post);
const postAuthor = createField(Post.name, 'author', Post, {
    collection: false,
    through: undefined,
    from: postAuthorId,
    to: userId,
});
Post.id = postId;
Post.fields.set('id', postId);
Post.fields.set('title', postTitle);
Post.fields.set('authorId', postAuthorId);
Post.fields.set('author', postAuthor);

const data = {posts: [['Hello', 'Alex', 2]]};
const res = query(Post, {select: {title: 0, author: {name: 0}}}, data);
console.log(res);
