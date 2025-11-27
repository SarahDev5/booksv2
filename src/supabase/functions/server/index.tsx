import { Hono } from 'npm:hono';
import { cors } from 'npm:hono/cors';
import { logger } from 'npm:hono/logger';
import { createClient } from 'npm:@supabase/supabase-js@2';
import * as kv from './kv_store.tsx';

const app = new Hono();

app.use('*', cors());
app.use('*', logger(console.log));

const supabase = createClient(
  Deno.env.get('VITE_SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

// Helper function to verify user authentication
async function verifyUser(request: Request) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return { error: 'No token provided', userId: null };
  }

  const accessToken = authHeader.split(' ')[1];
  const { data, error } = await supabase.auth.getUser(accessToken);

  if (error || !data.user) {
    return { error: error?.message || 'Unauthorized', userId: null };
  }

  return { error: null, userId: data.user.id };
}

// Generate unique ID
function generateId() {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// Sign up route
app.post('/make-server-5595ca76/signup', async (c) => {
  try {
    const body = await c.req.json();
    const { email, password, name } = body;
    
    if (!email || !password || !name) {
      return c.json({ error: 'Email, password, and name are required' }, 400);
    }
    
    // Create user in Supabase Auth
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      user_metadata: { name },
      // Automatically confirm the user's email since an email server hasn't been configured.
      email_confirm: true
    });
    
    if (error) {
      console.log('Signup error:', error);
      return c.json({ error: error.message }, 400);
    }
    
    // Store user profile in KV store
    await kv.set(`user:${data.user.id}`, {
      id: data.user.id,
      email,
      name
    });
    
    return c.json({ success: true, user: data.user });
  } catch (error) {
    console.log('Signup error:', error);
    return c.json({ error: 'Failed to sign up' }, 500);
  }
});

// Get all books (public)
app.get('/make-server-5595ca76/books', async (c) => {
  try {
    const books = await kv.getByPrefix('book:');
    return c.json({ books: books || [] });
  } catch (error) {
    console.log('Error fetching books:', error);
    return c.json({ error: 'Failed to fetch books' }, 500);
  }
});

// Get all collections (public)
app.get('/make-server-5595ca76/collections', async (c) => {
  try {
    const collections = await kv.getByPrefix('collection:');
    
    // Enrich collections with user names
    const enrichedCollections = await Promise.all(
      (collections || []).map(async (collection: any) => {
        const user = await kv.get(`user:${collection.userId}`);
        return {
          ...collection,
          userName: user?.name || 'Unknown User'
        };
      })
    );
    
    return c.json({ collections: enrichedCollections });
  } catch (error) {
    console.log('Error fetching collections:', error);
    return c.json({ error: 'Failed to fetch collections' }, 500);
  }
});

// Get user's collections by userId (public)
app.get('/make-server-5595ca76/user/:userId/collections', async (c) => {
  try {
    const userId = c.req.param('userId');
    const allCollections = await kv.getByPrefix('collection:');
    const userCollections = (allCollections || []).filter((col: any) => col.userId === userId);
    
    // Get user info
    const user = await kv.get(`user:${userId}`);
    
    return c.json({ 
      collections: userCollections,
      userName: user?.name || 'Unknown User'
    });
  } catch (error) {
    console.log('Error fetching user collections:', error);
    return c.json({ error: 'Failed to fetch user collections' }, 500);
  }
});

// Get books for a specific collection (public)
app.get('/make-server-5595ca76/collection/:collectionId/books', async (c) => {
  try {
    const collectionId = c.req.param('collectionId');
    const allBooks = await kv.getByPrefix('book:');
    const collectionBooks = (allBooks || []).filter((book: any) => book.collectionId === collectionId);
    
    // Get collection info
    const collection = await kv.get(`collection:${collectionId}`);
    
    return c.json({ 
      books: collectionBooks,
      collection: collection || null
    });
  } catch (error) {
    console.log('Error fetching collection books:', error);
    return c.json({ error: 'Failed to fetch collection books' }, 500);
  }
});

// Get logged-in user's books (protected)
app.get('/make-server-5595ca76/my/books', async (c) => {
  try {
    const { error, userId } = await verifyUser(c.req.raw);
    if (error || !userId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }
    
    const allBooks = await kv.getByPrefix('book:');
    const userBooks = (allBooks || []).filter((book: any) => book.userId === userId);
    
    return c.json({ books: userBooks });
  } catch (error) {
    console.log('Error fetching user books:', error);
    return c.json({ error: 'Failed to fetch user books' }, 500);
  }
});

// Get logged-in user's collections (protected)
app.get('/make-server-5595ca76/my/collections', async (c) => {
  try {
    const { error, userId } = await verifyUser(c.req.raw);
    if (error || !userId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }
    
    const allCollections = await kv.getByPrefix('collection:');
    const userCollections = (allCollections || []).filter((col: any) => col.userId === userId);
    
    return c.json({ collections: userCollections });
  } catch (error) {
    console.log('Error fetching user collections:', error);
    return c.json({ error: 'Failed to fetch user collections' }, 500);
  }
});

// Create collection (protected)
app.post('/make-server-5595ca76/my/collections', async (c) => {
  try {
    const { error, userId } = await verifyUser(c.req.raw);
    if (error || !userId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }
    
    const body = await c.req.json();
    const { name, description } = body;
    
    if (!name) {
      return c.json({ error: 'Collection name is required' }, 400);
    }
    
    const collectionId = generateId();
    const collection = {
      id: collectionId,
      name,
      description: description || '',
      userId,
      createdAt: new Date().toISOString()
    };
    
    await kv.set(`collection:${collectionId}`, collection);
    
    return c.json({ success: true, collection });
  } catch (error) {
    console.log('Error creating collection:', error);
    return c.json({ error: 'Failed to create collection' }, 500);
  }
});

// Create book (protected)
app.post('/make-server-5595ca76/my/books', async (c) => {
  try {
    const { error, userId } = await verifyUser(c.req.raw);
    if (error || !userId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }
    
    const body = await c.req.json();
    const { title, author, description, collectionId, coverImage } = body;
    
    if (!title || !collectionId) {
      return c.json({ error: 'Title and collection are required' }, 400);
    }
    
    // Verify collection belongs to user
    const collection = await kv.get(`collection:${collectionId}`);
    if (!collection || collection.userId !== userId) {
      return c.json({ error: 'Invalid collection' }, 403);
    }
    
    const bookId = generateId();
    const book = {
      id: bookId,
      title,
      author: author || '',
      description: description || '',
      coverImage: coverImage || '',
      collectionId,
      userId,
      createdAt: new Date().toISOString()
    };
    
    await kv.set(`book:${bookId}`, book);
    
    return c.json({ success: true, book });
  } catch (error) {
    console.log('Error creating book:', error);
    return c.json({ error: 'Failed to create book' }, 500);
  }
});

// Update book (protected)
app.put('/make-server-5595ca76/my/books/:id', async (c) => {
  try {
    const { error, userId } = await verifyUser(c.req.raw);
    if (error || !userId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }
    
    const bookId = c.req.param('id');
    const book = await kv.get(`book:${bookId}`);
    
    if (!book || book.userId !== userId) {
      return c.json({ error: 'Book not found or unauthorized' }, 403);
    }
    
    const body = await c.req.json();
    const updatedBook = {
      ...book,
      title: body.title || book.title,
      author: body.author !== undefined ? body.author : book.author,
      description: body.description !== undefined ? body.description : book.description,
      coverImage: body.coverImage !== undefined ? body.coverImage : book.coverImage,
      collectionId: body.collectionId || book.collectionId,
      updatedAt: new Date().toISOString()
    };
    
    await kv.set(`book:${bookId}`, updatedBook);
    
    return c.json({ success: true, book: updatedBook });
  } catch (error) {
    console.log('Error updating book:', error);
    return c.json({ error: 'Failed to update book' }, 500);
  }
});

// Delete book (protected)
app.delete('/make-server-5595ca76/my/books/:id', async (c) => {
  try {
    const { error, userId } = await verifyUser(c.req.raw);
    if (error || !userId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }
    
    const bookId = c.req.param('id');
    const book = await kv.get(`book:${bookId}`);
    
    if (!book || book.userId !== userId) {
      return c.json({ error: 'Book not found or unauthorized' }, 403);
    }
    
    await kv.del(`book:${bookId}`);
    
    return c.json({ success: true });
  } catch (error) {
    console.log('Error deleting book:', error);
    return c.json({ error: 'Failed to delete book' }, 500);
  }
});

// Delete collection (protected)
app.delete('/make-server-5595ca76/my/collections/:id', async (c) => {
  try {
    const { error, userId } = await verifyUser(c.req.raw);
    if (error || !userId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }
    
    const collectionId = c.req.param('id');
    const collection = await kv.get(`collection:${collectionId}`);
    
    if (!collection || collection.userId !== userId) {
      return c.json({ error: 'Collection not found or unauthorized' }, 403);
    }
    
    // Delete all books in this collection
    const allBooks = await kv.getByPrefix('book:');
    const booksToDelete = (allBooks || []).filter((book: any) => book.collectionId === collectionId);
    
    await Promise.all(
      booksToDelete.map((book: any) => kv.del(`book:${book.id}`))
    );
    
    await kv.del(`collection:${collectionId}`);
    
    return c.json({ success: true });
  } catch (error) {
    console.log('Error deleting collection:', error);
    return c.json({ error: 'Failed to delete collection' }, 500);
  }
});

// Get user profile (protected)
app.get('/make-server-5595ca76/my/profile', async (c) => {
  try {
    const { error, userId } = await verifyUser(c.req.raw);
    if (error || !userId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }
    
    const user = await kv.get(`user:${userId}`);
    
    return c.json({ user });
  } catch (error) {
    console.log('Error fetching profile:', error);
    return c.json({ error: 'Failed to fetch profile' }, 500);
  }
});

// Update user profile (protected)
app.put('/make-server-5595ca76/my/profile', async (c) => {
  try {
    const { error, userId } = await verifyUser(c.req.raw);
    if (error || !userId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }
    
    const user = await kv.get(`user:${userId}`);
    if (!user) {
      return c.json({ error: 'User not found' }, 404);
    }
    
    const body = await c.req.json();
    const updatedUser = {
      ...user,
      name: body.name || user.name,
      bio: body.bio !== undefined ? body.bio : user.bio,
      updatedAt: new Date().toISOString()
    };
    
    await kv.set(`user:${userId}`, updatedUser);
    
    return c.json({ success: true, user: updatedUser });
  } catch (error) {
    console.log('Error updating profile:', error);
    return c.json({ error: 'Failed to update profile' }, 500);
  }
});

Deno.serve(app.fetch);
