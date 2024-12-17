import 'dotenv/config';
import express, { Express, Request, Response } from "express";
import { MongoClient } from "mongodb";
import { callAgent } from './agent';

const app: Express = express();
app.use(express.json());

// Initialize MongoDB client
const client = new MongoClient(process.env.MONGODB_ATLAS_URI as string);

async function startServer() {
  try {
    await client.connect();
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");

    app.get('/', (req: Request, res: Response) => {
      res.send('LangGraph Agent Server');
    });

    app.post('/chat', async (req: Request, res: Response) => {
      const initialMessage = req.body.message;
      const threadId = Date.now().toString();
      
      console.log('Received chat request:', {
        threadId,
        message: initialMessage,
        body: req.body,
        headers: req.headers
      });
      
      try {
        const response = await callAgent(client, initialMessage, threadId);
        res.json({ threadId, response });
      } catch (error) {
        console.error('Error starting conversation:', {
          error,
          stack: error instanceof Error ? error.stack : undefined,
          message: initialMessage,
          threadId
        });
        res.status(500).json({ 
          error: 'Internal server error',
          details: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });

    app.post('/chat/:threadId', async (req: Request, res: Response) => {
      const { threadId } = req.params;
      const { message } = req.body;
      
      console.log('Received follow-up chat request:', {
        threadId,
        message,
        body: req.body,
        headers: req.headers
      });
      
      try {
        const response = await callAgent(client, message, threadId);
        res.json({ response });
      } catch (error) {
        console.error('Error in chat:', {
          error,
          stack: error instanceof Error ? error.stack : undefined,
          message,
          threadId
        });
        res.status(500).json({ 
          error: 'Internal server error',
          details: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });

    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Error connecting to MongoDB:', error);
    process.exit(1);
  }
}

startServer();