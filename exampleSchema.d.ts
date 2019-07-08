/// <reference path="./index.ts" />

type UserId = Id<'UserId'>;
type PostId = Id<'PostId'>;
type PostCommentId = Id<'PostCommentId'>;
type PostLikeId = Id<'PostLikeId'>;
type CommentId = Id<'CommentId'>;

interface User {
    id: UserId;
    name: string;
}

interface Post {
    id: PostId;
    title: string;
    authorId: UserId;
    author: User;
    likes: PostLike[];
    comments: PostComment['comment'][];
}

interface PostComment {
    id: PostCommentId;
    postId: PostId;
    commentId: CommentId;
    comment: Comment;
}

interface PostLike {
    id: PostLikeId;
    postId: PostId;
    userId: UserId;
    user: User;
}

interface Comment {
    id: CommentId;
    userId: UserId;
    user: User;
    text: string;
}
