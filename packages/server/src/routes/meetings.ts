import type { FastifyInstance } from 'fastify';
import type { MeetingExecutor } from '../services/meeting-executor.js';
import { getAllMeetings, getMeetingById } from '../db/queries/meetings.js';
import { getDb } from '../db/connection.js';

export function createMeetingRoutes(meetingExecutor: MeetingExecutor) {
  return async function meetingRoutes(app: FastifyInstance) {
    app.get('/api/meetings', async () => getAllMeetings(getDb()));

    app.get<{ Params: { id: string } }>('/api/meetings/:id', async (request, reply) => {
      const meeting = getMeetingById(getDb(), request.params.id);
      if (!meeting) return reply.code(404).send({ error: 'Meeting not found' });
      return meeting;
    });

    app.post<{ Body: { title: string; topic: string; participantIds: string[] } }>(
      '/api/meetings', async (request, reply) => {
        const { title, topic, participantIds } = request.body;
        if (!topic || !participantIds?.length) {
          return reply.code(400).send({ error: 'Topic and participants required' });
        }
        try {
          const meeting = await meetingExecutor.startMeeting(title || '跨部门会议', topic, participantIds);
          return meeting;
        } catch (err: any) {
          return reply.code(400).send({ error: err.message });
        }
      });

    // POST /api/meetings/:id/followup — add a follow-up question, participants respond again
    app.post<{ Params: { id: string }; Body: { message: string } }>(
      '/api/meetings/:id/followup', async (request, reply) => {
        const meeting = getMeetingById(getDb(), request.params.id);
        if (!meeting) return reply.code(404).send({ error: 'Meeting not found' });
        if (!request.body.message) return reply.code(400).send({ error: 'Message required' });
        try {
          await meetingExecutor.addFollowup(request.params.id, request.body.message);
          return { ok: true };
        } catch (err: any) {
          return reply.code(400).send({ error: err.message });
        }
      });

    // POST /api/meetings/:id/dispatch — convert meeting outcomes to department tasks
    app.post<{ Params: { id: string } }>('/api/meetings/:id/dispatch', async (request, reply) => {
      const meeting = getMeetingById(getDb(), request.params.id);
      if (!meeting) return reply.code(404).send({ error: 'Meeting not found' });
      try {
        const result = await meetingExecutor.dispatchWork(request.params.id);
        return result;
      } catch (err: any) {
        return reply.code(400).send({ error: err.message });
      }
    });

    // POST /api/meetings/:id/synthesize — create unified project report from all department results
    app.post<{ Params: { id: string }; Body: { synthesizerId?: string } }>(
      '/api/meetings/:id/synthesize', async (request, reply) => {
        const meeting = getMeetingById(getDb(), request.params.id);
        if (!meeting) return reply.code(404).send({ error: 'Meeting not found' });
        try {
          const result = await meetingExecutor.synthesizeResults(request.params.id, request.body?.synthesizerId);
          return result;
        } catch (err: any) {
          return reply.code(400).send({ error: err.message });
        }
      });
  };
}
