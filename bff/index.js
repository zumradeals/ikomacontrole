import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const fastify = Fastify({
  logger: true
});

// Configuration
const IKOMA_ORDERS_BASE_URL = process.env.IKOMA_ORDERS_BASE_URL || 'https://api.ikomadigit.com/v1';
const IKOMA_ADMIN_KEY = process.env.IKOMA_ADMIN_KEY;
const AUTH_MODE = process.env.AUTH_MODE || 'none'; // 'supabase' or 'none'
const SUPABASE_JWT_SECRET = process.env.SUPABASE_JWT_SECRET;

// Register CORS
fastify.register(cors, {
  origin: true 
});

// Register JWT if using Supabase auth
if (AUTH_MODE === 'supabase' && SUPABASE_JWT_SECRET) {
  fastify.register(jwt, {
    secret: SUPABASE_JWT_SECRET
  });
}

// Auth Middleware
fastify.addHook('preHandler', async (request, reply) => {
  if (request.url === '/api/health') return;
  
  if (AUTH_MODE === 'supabase') {
    try {
      await request.jwtVerify();
    } catch (err) {
      reply.code(401).send({ error: 'Unauthorized', message: 'Invalid or missing token' });
    }
  }
});

// Helper for Orders API calls with detailed logging
const ordersApi = axios.create({
  baseURL: IKOMA_ORDERS_BASE_URL,
  headers: {
    'x-ikoma-admin-key': IKOMA_ADMIN_KEY,
    'Content-Type': 'application/json'
  }
});

// Response interceptor for logging
ordersApi.interceptors.response.use(
  (response) => {
    console.info(`[BFF Proxy] SUCCESS: ${response.config.method.toUpperCase()} ${response.config.url} -> ${response.status}`);
    return response;
  },
  (error) => {
    const status = error.response?.status || 'NETWORK_ERROR';
    const target = error.config?.url || 'unknown';
    const method = error.config?.method?.toUpperCase() || 'unknown';
    console.error(`[BFF Proxy] ERROR: ${method} ${target} -> ${status}`);
    if (error.response?.data) {
      console.error(`[BFF Proxy] Payload:`, JSON.stringify(error.response.data));
    }
    return Promise.reject(error);
  }
);

// Routes
fastify.get('/api/health', async () => {
  try {
    const response = await axios.get(`${IKOMA_ORDERS_BASE_URL.replace('/v1', '')}/health`);
    return { status: 'ok', ordersApi: response.data };
  } catch (error) {
    return { status: 'ok', ordersApi: 'unreachable' };
  }
});

// Runners
fastify.get('/api/runners', async (request, reply) => {
  try {
    const response = await ordersApi.get('/runners');
    return response.data;
  } catch (error) {
    reply.code(error.response?.status || 500).send({
      ... (error.response?.data || { error: 'Internal Server Error' }),
      proxy_target: `${IKOMA_ORDERS_BASE_URL}/runners`,
      proxy_status: error.response?.status
    });
  }
});

fastify.post('/api/runners', async (request, reply) => {
  try {
    const response = await ordersApi.post('/runners', request.body);
    return response.data;
  } catch (error) {
    reply.code(error.response?.status || 500).send(error.response?.data || { error: 'Internal Server Error' });
  }
});

fastify.delete('/api/runners/:id', async (request, reply) => {
  try {
    const { id } = request.params;
    const response = await ordersApi.delete(`/runners/${id}`);
    return response.data;
  } catch (error) {
    reply.code(error.response?.status || 500).send(error.response?.data || { error: 'Internal Server Error' });
  }
});

fastify.post('/api/runners/:id/token/reset', async (request, reply) => {
  try {
    const { id } = request.params;
    const response = await ordersApi.post(`/runners/${id}/token/reset`, {});
    return response.data;
  } catch (error) {
    reply.code(error.response?.status || 500).send(error.response?.data || { error: 'Internal Server Error' });
  }
});

// Servers
fastify.get('/api/servers', async (request, reply) => {
  try {
    const response = await ordersApi.get('/servers');
    return response.data;
  } catch (error) {
    reply.code(error.response?.status || 500).send({
      ... (error.response?.data || { error: 'Internal Server Error' }),
      proxy_target: `${IKOMA_ORDERS_BASE_URL}/servers`,
      proxy_status: error.response?.status
    });
  }
});

fastify.post('/api/servers', async (request, reply) => {
  try {
    const response = await ordersApi.post('/servers', request.body);
    return response.data;
  } catch (error) {
    reply.code(error.response?.status || 500).send(error.response?.data || { error: 'Internal Server Error' });
  }
});

fastify.patch('/api/servers/:id', async (request, reply) => {
  try {
    const { id } = request.params;
    const response = await ordersApi.patch(`/servers/${id}`, request.body);
    return response.data;
  } catch (error) {
    reply.code(error.response?.status || 500).send({
      ... (error.response?.data || { error: 'Internal Server Error' }),
      proxy_target: `${IKOMA_ORDERS_BASE_URL}/servers/${id}`,
      proxy_status: error.response?.status,
      proxy_error: error.response?.data
    });
  }
});

fastify.delete('/api/servers/:id', async (request, reply) => {
  try {
    const { id } = request.params;
    const response = await ordersApi.delete(`/servers/${id}`);
    return response.data;
  } catch (error) {
    reply.code(error.response?.status || 500).send(error.response?.data || { error: 'Internal Server Error' });
  }
});

// Start server
const start = async () => {
  try {
    await fastify.listen({ port: 3000, host: '0.0.0.0' });
    console.log('BFF is running on port 3000');
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
