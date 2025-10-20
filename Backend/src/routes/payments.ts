import express, { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import Stripe from 'stripe';
import pool from '../config/database';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import logger from '../utils/logger';

const router = Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
});

// Create Stripe Payment Intent
router.post(
  '/stripe/create-intent',
  authenticateToken,
  [body('order_id').isUUID().withMessage('Invalid order ID')],
  async (req: AuthRequest, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { order_id } = req.body;

      // Get order details
      const order = await pool.query(
        'SELECT * FROM orders WHERE id = $1 AND user_id = $2 AND status = $3',
        [order_id, req.user!.id, 'pending']
      );

      if (order.rows.length === 0) {
        return res.status(404).json({ error: 'Order not found or already processed' });
      }

      const { total_cents, currency, order_number } = order.rows[0];

      // Create Stripe Payment Intent
      const paymentIntent = await stripe.paymentIntents.create({
        amount: total_cents,
        currency: currency.toLowerCase(),
        metadata: {
          order_id,
          order_number,
          user_id: req.user!.id,
        },
        automatic_payment_methods: {
          enabled: true,
        },
      });

      // Update order with payment intent ID
      await pool.query(
        'UPDATE orders SET payment_intent_id = $1, payment_method = $2 WHERE id = $3',
        [paymentIntent.id, 'stripe', order_id]
      );

      res.json({
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Create payment intent error: ${msg}`);
      res.status(500).json({ error: 'Failed to create payment intent' });
    }
  }
);

// Stripe Webhook Handler
router.post(
  '/stripe/webhook',
  express.raw({ type: 'application/json' }),
  async (req: Request, res: Response) => {
    const sig = req.headers['stripe-signature'] as string;

  let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET!
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      logger.error(`Webhook signature verification failed: ${message}`);
      return res.status(400).send(`Webhook Error: ${message}`);
    }

    // Handle the event
    switch (event.type) {
      case 'payment_intent.succeeded': {
        const intent = event.data.object as Stripe.PaymentIntent;
        await handleSuccessfulPayment(
          {
            id: intent.id,
            amount: intent.amount,
            metadata: { order_id: String(intent.metadata.order_id) },
          },
          'stripe'
        );
        break;
      }
      case 'payment_intent.payment_failed': {
        const failedIntent = event.data.object as Stripe.PaymentIntent;
        await handleFailedPayment(String(failedIntent.metadata.order_id), 'stripe');
        break;
      }
      default: {
        logger.info(`Unhandled event type ${event.type}`);
      }
    }

    res.json({ received: true });
  }
);

// PayPal Create Order
router.post(
  '/paypal/create-order',
  authenticateToken,
  [body('order_id').isUUID().withMessage('Invalid order ID')],
  async (req: AuthRequest, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { order_id } = req.body;

      // Get order details
      const order = await pool.query(
        'SELECT * FROM orders WHERE id = $1 AND user_id = $2 AND status = $3',
        [order_id, req.user!.id, 'pending']
      );

      if (order.rows.length === 0) {
        return res.status(404).json({ error: 'Order not found or already processed' });
      }

      const { total_cents, currency } = order.rows[0];

      // Create PayPal order (simplified - use PayPal SDK in production)
      const paypalOrderId = `PAYPAL-${Date.now()}`;

      // Update order with PayPal order ID
      await pool.query(
        'UPDATE orders SET payment_intent_id = $1, payment_method = $2 WHERE id = $3',
        [paypalOrderId, 'paypal', order_id]
      );

      res.json({
        paypalOrderId,
        amount: (total_cents / 100).toFixed(2),
        currency,
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Create PayPal order error: ${msg}`);
      res.status(500).json({ error: 'Failed to create PayPal order' });
    }
  }
);

// PayPal Capture Payment
router.post(
  '/paypal/capture',
  authenticateToken,
  [
    body('paypal_order_id').notEmpty().withMessage('PayPal order ID is required'),
    body('order_id').isUUID().withMessage('Invalid order ID'),
  ],
  async (req: AuthRequest, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { paypal_order_id, order_id } = req.body;

      // Verify order belongs to user
      const order = await pool.query(
        'SELECT * FROM orders WHERE id = $1 AND user_id = $2',
        [order_id, req.user!.id]
      );

      if (order.rows.length === 0) {
        return res.status(404).json({ error: 'Order not found' });
      }

      // In production, verify with PayPal API
      // For now, simulate successful payment
      await handleSuccessfulPayment(
        {
          id: paypal_order_id,
          metadata: { order_id },
          amount: order.rows[0].total_cents,
        },
        'paypal'
      );

      res.json({
        message: 'Payment captured successfully',
        order_id,
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Capture PayPal payment error: ${msg}`);
      res.status(500).json({ error: 'Failed to capture payment' });
    }
  }
);

type PaymentData = { id: string; amount: number; metadata: { order_id: string } };

// Helper function to handle successful payment
async function handleSuccessfulPayment(paymentData: PaymentData, provider: 'stripe' | 'paypal') {
  try {
    const order_id = paymentData.metadata.order_id;

    // Update order status
    await pool.query(
      'UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2',
      ['paid', order_id]
    );

    // Record payment
    await pool.query(
      `INSERT INTO payments (order_id, provider, provider_payment_id, amount_cents, status, raw_event)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        order_id,
        provider,
        paymentData.id,
        paymentData.amount,
        'completed',
        JSON.stringify(paymentData),
      ]
    );

    // Generate and store account credentials
    await generateAccountCredentials(order_id);

    // TODO: Send confirmation email
    logger.info(`Order ${order_id} paid successfully via ${provider}`);
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    logger.error(`Handle successful payment error: ${msg}`);
  }
}

// Helper function to handle failed payment
async function handleFailedPayment(order_id: string, provider: 'stripe' | 'paypal') {
  try {
    await pool.query(
      'UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2',
      ['failed', order_id]
    );

    logger.warn(`Order ${order_id} payment failed via ${provider}`);
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    logger.error(`Handle failed payment error: ${msg}`);
  }
}

// Helper function to generate account credentials
async function generateAccountCredentials(order_id: string) {
  try {
    // Get order items
    const order = await pool.query('SELECT items FROM orders WHERE id = $1', [order_id]);

    if (order.rows.length === 0) return;

    const items = order.rows[0].items;

    // Generate credentials for each product
    for (const item of items) {
      // Generate dummy credentials (replace with real logic)
      const credentials = {
        username: `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        password: Math.random().toString(36).substr(2, 15),
        api_key: `sk_${Math.random().toString(36).substr(2, 32)}`,
        instructions: 'Login at https://platform.example.com with the provided credentials',
      };

      await pool.query(
        `INSERT INTO account_credentials (order_id, product_id, credentials, delivered)
         VALUES ($1, $2, $3, $4)`,
        [order_id, item.product_id, JSON.stringify(credentials), true]
      );
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    logger.error(`Generate credentials error: ${msg}`);
  }
}

export default router;
