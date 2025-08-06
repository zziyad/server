async (post, userId) => {
  const { create } = await lib.repository;
  const { title, content, category, images, main_image_index } = post;

  console.log({ POST_CREATE: post });

  const slug = title
    .split(' ')
    .join('-')
    .toLowerCase()
    .replace(/[^a-zA-Z0-9-]/g, '');

  try {
    // Create a new instance for new_posts
    const postClass = await create('new_posts', 'id');
    // console.log({ postClass });
    const newPost = await postClass({
      user_id: userId,
      title,
      content,
      category,
      main_image_index,
      slug,
    });

    // Get the ID of the newly created post
    const postId = newPost.id;

    for (const image of images) {
      const query =
        'INSERT INTO post_images (post_id, image_path) VALUES ($1, $2)';

      const values = [postId, image];
      db.pg.query(query, values);
    }

    // await db.client.query('COMMIT');
    return newPost;
  } catch (error) {
    // await db.client.query('ROLLBACK');
    if (error.code === '23505') {
      throw new Error(`Duplicate - ${error.message}`);
    }

    throw new Error(error);
  }
};
