"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importStar(require("express"));
const express_validator_1 = require("express-validator");
const stripe_1 = __importDefault(require("stripe"));
const database_1 = __importDefault(require("../config/database"));
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
const stripe = new stripe_1.default(process.env.STRIPE_SECRET_KEY, {
    apiVersion: '2023-10-16',
});
router.post('/stripe/create-intent', auth_1.authenticateToken, [(0, express_validator_1.body)('order_id').isUUID().withMessage('Invalid order ID')], async (req, res) => {
    try {
        const errors = (0, express_validator_1.validationResult)(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        const { order_id } = req.body;
        const order = await database_1.default.query('SELECT * FROM orders WHERE id = $1 AND user_id = $2 AND status = $3', [order_id, req.user.id, 'pending']);
        if (order.rows.length === 0) {
            return res.status(404).json({ error: 'Order not found or already processed' });
        }
        const { total_cents, currency, order_number } = order.rows[0];
        const paymentIntent = await stripe.paymentIntents.create({
            amount: total_cents,
            currency: currency.toLowerCase(),
            metadata: {
                order_id,
                order_number,
                user_id: req.user.id,
            },
            automatic_payment_methods: {
                enabled: true,
            },
        });
        await database_1.default.query('UPDATE orders SET payment_intent_id = $1, payment_method = $2 WHERE id = $3', [paymentIntent.id, 'stripe', order_id]);
        res.json({
            clientSecret: paymentIntent.client_secret,
            paymentIntentId: paymentIntent.id,
        });
    }
    catch (error) {
        console.error('Create payment intent error:', error);
        res.status(500).json({ error: 'Failed to create payment intent' });
    }
});
router.post('/stripe/webhook', express_1.default.raw({ type: 'application/json' }), async (req, res) => {
    const sig = req.headers['stripe-signature'];
    let event;
    try {
        event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
    }
    catch (err) {
        console.error('Webhook signature verification failed:', err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }
    switch (event.type) {
        case 'payment_intent.succeeded':
            const paymentIntent = event.data.object;
            await handleSuccessfulPayment(paymentIntent, 'stripe');
            break;
        case 'payment_intent.payment_failed':
            const failedIntent = event.data.object;
            await handleFailedPayment(failedIntent.metadata.order_id, 'stripe');
            break;
        default:
            console.log(`Unhandled event type ${event.type}`);
    }
    res.json({ received: true });
});
router.post('/paypal/create-order', auth_1.authenticateToken, [(0, express_validator_1.body)('order_id').isUUID().withMessage('Invalid order ID')], async (req, res) => {
    try {
        const errors = (0, express_validator_1.validationResult)(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        const { order_id } = req.body;
        const order = await database_1.default.query('SELECT * FROM orders WHERE id = $1 AND user_id = $2 AND status = $3', [order_id, req.user.id, 'pending']);
        if (order.rows.length === 0) {
            return res.status(404).json({ error: 'Order not found or already processed' });
        }
        const { total_cents, currency } = order.rows[0];
        const paypalOrderId = `PAYPAL-${Date.now()}`;
        await database_1.default.query('UPDATE orders SET payment_intent_id = $1, payment_method = $2 WHERE id = $3', [paypalOrderId, 'paypal', order_id]);
        res.json({
            paypalOrderId,
            amount: (total_cents / 100).toFixed(2),
            currency,
        });
    }
    catch (error) {
        console.error('Create PayPal order error:', error);
        res.status(500).json({ error: 'Failed to create PayPal order' });
    }
});
router.post('/paypal/capture', auth_1.authenticateToken, [
    (0, express_validator_1.body)('paypal_order_id').notEmpty().withMessage('PayPal order ID is required'),
    (0, express_validator_1.body)('order_id').isUUID().withMessage('Invalid order ID'),
], async (req, res) => {
    try {
        const errors = (0, express_validator_1.validationResult)(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        const { paypal_order_id, order_id } = req.body;
        const order = await database_1.default.query('SELECT * FROM orders WHERE id = $1 AND user_id = $2', [order_id, req.user.id]);
        if (order.rows.length === 0) {
            return res.status(404).json({ error: 'Order not found' });
        }
        await handleSuccessfulPayment({
            id: paypal_order_id,
            metadata: { order_id },
            amount: order.rows[0].total_cents,
        }, 'paypal');
        res.json({
            message: 'Payment captured successfully',
            order_id,
        });
    }
    catch (error) {
        console.error('Capture PayPal payment error:', error);
        res.status(500).json({ error: 'Failed to capture payment' });
    }
});
async function handleSuccessfulPayment(paymentData, provider) {
    try {
        const order_id = paymentData.metadata.order_id;
        await database_1.default.query('UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2', ['paid', order_id]);
        await database_1.default.query(`INSERT INTO payments (order_id, provider, provider_payment_id, amount_cents, status, raw_event)
       VALUES ($1, $2, $3, $4, $5, $6)`, [
            order_id,
            provider,
            paymentData.id,
            paymentData.amount,
            'completed',
            JSON.stringify(paymentData),
        ]);
        await generateAccountCredentials(order_id);
        console.log(`Order ${order_id} paid successfully via ${provider}`);
    }
    catch (error) {
        console.error('Handle successful payment error:', error);
    }
}
async function handleFailedPayment(order_id, provider) {
    try {
        await database_1.default.query('UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2', ['failed', order_id]);
        console.log(`Order ${order_id} payment failed via ${provider}`);
    }
    catch (error) {
        console.error('Handle failed payment error:', error);
    }
}
async function generateAccountCredentials(order_id) {
    try {
        const order = await database_1.default.query('SELECT items FROM orders WHERE id = $1', [order_id]);
        if (order.rows.length === 0)
            return;
        const items = order.rows[0].items;
        for (const item of items) {
            const credentials = {
                username: `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                password: Math.random().toString(36).substr(2, 15),
                api_key: `sk_${Math.random().toString(36).substr(2, 32)}`,
                instructions: 'Login at https://platform.example.com with the provided credentials',
            };
            await database_1.default.query(`INSERT INTO account_credentials (order_id, product_id, credentials, delivered)
         VALUES ($1, $2, $3, $4)`, [order_id, item.product_id, JSON.stringify(credentials), true]);
        }
    }
    catch (error) {
        console.error('Generate credentials error:', error);
    }
}
exports.default = router;
//# sourceMappingURL=payments.js.map