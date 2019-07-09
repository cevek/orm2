import {Id, Create, Update, SelectConstraint, Find, SelectResult, PickId, DBQuery} from '../types';

export {};

type PostId = Id<'PostId'>;
type StatId = Id<'StatId'>;
type UserId = Id<'UserId'>;
type CommentId = Id<'CommentId'>;
type AttachmentId = Id<'AttachmentId'>;

interface Post {
    readonly id: PostId;
    authorId: UserId;
    author: User;
    createdAt?: Date;
    text: string;
    title: string;
    postStatId: StatId;
    postStat: Stat;
    comments: PostComment['comment'][];
}

interface PostComment {
    readonly id: number;
    commentId: CommentId;
    comment: Comment;
    postId: PostId;
    post: Post;
}

interface Stat {
    readonly id: StatId;
    views: number;
}

interface User {
    readonly id: UserId;
    name: string;
    posts: Post[];
    friends: UserUser['friend'][];
}
interface UserUser {
    readonly id: number;
    type: string;
    userId: UserId;
    user: User;
    friendId: UserId;
    friend: User;
}
interface Comment {
    readonly id: CommentId;
    postId: PostId;
    author: User;
    authorId: UserId;
    text: string;
    subcomments: Comment[];
    attachments: Attachment[];
}
interface Attachment {
    readonly id: AttachmentId;
    commentId: CommentId;
    filename: string;
    ownerId: UserId;
    owner: User;
}
declare function insertPost(post: Create<Post>): {};
declare function updatePost(post: Update<Post> & PickId<Post>): {};
declare function deletePost(post: PickId<Post>): {};

declare function findPost<T extends SelectConstraint<T, Post>, CustomFields extends {[key: string]: DBQuery}>(
    data: (Find<Post> & {customFields?: CustomFields}) | {select: T},
): SelectResult<T, Post> & {[P in keyof CustomFields]: string | null};

const userId = 1 as UserId;
const db = {
    post: {
        lastId: 0 as PostId,
    },
    user: {
        lastId: 0 as UserId,
    },
    comment: {
        lastId: 0 as CommentId,
    },
    stat: {
        lastId: 0 as StatId,
    },
};
insertPost({authorId: userId, postStatId: db.stat.lastId, title: '', createdAt: new Date(), text: ''});
insertPost({
    authorId: userId,
    title: '',
    // createdAt: new Date(),
    text: '',
    postStatId: db.stat.lastId,
    postStat: {
        views: 0,
    },
    comments: [
        {
            authorId: userId,
            postId: db.post.lastId,
            text: '',
            attachments: [
                {
                    commentId: db.comment.lastId,
                    ownerId: userId,
                    filename: '',
                },
            ],
        },
    ],
});
deletePost({id: 1 as PostId});
updatePost({id: 1 as PostId});
updatePost({
    id: 1 as PostId,
    title: '',
    postStat: {
        views: 0,
    },
    createdAt: new Date(),
    comments: {
        create: [
            {
                postId: db.post.lastId,
                text: '',
                authorId: userId,
            },
        ],
        update: [
            {
                id: 1 as CommentId,
                text: '',
            },
        ],
        delete: [{id: 1 as CommentId}],
    },
});

type Foo<T, Entity> = Entity extends any[]
    ? T extends {select: any}
        ? Find<Entity[number], T['select']>
        : never
    : never;

type GH = Foo<
    {
        select: {
            text: 'foo';
        };
    },
    Post['comments']
>['select'];
type G = SelectConstraint<
    {
        comments: {
            select: {
                text: 1;
            };
        };
    },
    Post
>['comments']['select'];

const res = findPost({
    select: {
        id: 0,
        title: 0,
        createdAt: 0,
        author: {
            name: 0,
        },
        postStat: {
            views: 0,
        },
        comments: {
            select: {
                text: 0,
                author: {
                    name: 0,
                },
                subcomments: {
                    select: {
                        author: {
                            name: 0,
                        },
                    },
                },
            },
            selectCustom: {
                xxx: {} as DBQuery,
            },
            order: {
                author: {
                    name: 'asc',
                },
            },
            limit: 10,
        },
    },
    customFields: {
        score: {} as DBQuery,
    },
    where: {
        id: {eq: 1 as PostId},
        title: 'x',
        author: {OR: [{name: ''}]},
        createdAt: {
            between: [new Date(), new Date()],
        },
        postStat: {
            views: {
                gt: 100,
            },
        },
    },
    order: {
        postStat: {
            views: 'asc',
        },
    },
    limit: 10,
});

// type Gg = SelectResult2<
//     {
//         text: number;
//         author: {
//             name: number;
//         };
//         subcomments: {
//             select: {
//                 author: {
//                     name: number;
//                 };
//             };
//         };
//     },
//     Comment
// >;

// type A = {
//     b: B;
// };
// type B = {
//     a: A;
//     name: string;
// };

// // type FF<T, Entity> = {[P in Extract<keyof Entity, keyof T>]: FF<T[P], Entity[P]>};

// // type Ggg = FF<{b: {a: {b: {a: {b: {title: string}}}}}}, A>;

// var g!: Gg;
// g.subcomments.map(sub => sub.author.name);
// // g.map(x => x.subcomments)

res.score;
res.id;
res.author.name;
res.createdAt;
res.comments;
res.comments[0];
res.comments.map(x => x.subcomments.map(sub => sub.author.name));
res.comments[0].author.name;
// res.comments[0].xxx;
