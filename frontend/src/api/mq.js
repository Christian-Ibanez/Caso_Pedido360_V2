import { api } from './http';

// Administrador de RabbitMQ (ms-mqadmin, via BFF; solo rol Admin)
const enc = encodeURIComponent;

export const getQueues = () => api.get('/api/mq/queues');
export const createQueue = (body) => api.post('/api/mq/queues', body);
export const deleteQueue = (name, ifEmpty = true) => api.delete(`/api/mq/queues/${enc(name)}?ifEmpty=${ifEmpty}`);

export const getExchanges = () => api.get('/api/mq/exchanges');
export const createExchange = (body) => api.post('/api/mq/exchanges', body);
export const deleteExchange = (name) => api.delete(`/api/mq/exchanges/${enc(name)}`);

export const getBindings = () => api.get('/api/mq/bindings');
export const createBinding = (body) => api.post('/api/mq/bindings', body);
export const deleteBinding = ({ exchange, queue, routingKey }) =>
  api.delete(`/api/mq/bindings?exchange=${enc(exchange)}&queue=${enc(queue)}&routingKey=${enc(routingKey || '')}`);
