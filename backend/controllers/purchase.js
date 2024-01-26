const Razorpay = require('razorpay');
const Order = require('../models/orders');
const User = require('../models/users');

const logger = require('../logger');

const purchasepremium = async (req, res) => {
    try {
        var rzp = new Razorpay({
            key_id: process.env.RAZORPAY_KEY_ID,
            key_secret: process.env.RAZORPAY_KEY_SECRET
        });

        const amount = 3000;

        rzp.orders.create({amount, currency: "INR"}, (err, order) => {
            if (err) {
                throw new Error(JSON.stringify(err));
            }
            req.user.createOrder({ orderid: order.id, status: 'PENDING'}).then(() => {
                logger.info('Payment Completed : Success');
                return res.status(201).json({ order, key_id: rzp.key_id });
            }).catch(err => {
                throw new Error(err);
            });
        });
    } catch (err) {
        console.log(err);
        logger.error('Error processing request:', err);
        res.status(403).json({ message: 'Something went wrong', error: err });
    }
};


const updateTransactionStatus = async (req, res) => {
    try {
        const { payment_id, order_id } = req.body;
        
        // Find the order by order_id
        const order = await Order.findOne({ where: { orderid: order_id } });

        if (!order) {
            return res.status(404).json({ error: 'Order not found' });
        }

        // Find the associated user using the userId from the order
        const user = await User.findByPk(order.userId);

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Update the fields in both Order and User
        const promises = [
            order.update({ ispremium: true, paymentid: payment_id, status: 'SUCCESSFUL' }),
            user.update({ ispremiumuser: 'true' })
        ];

        await Promise.all(promises);
        logger.info('Transaction Status Updated : Success');
        return res.status(202).json({ success: true, message: "Transaction Successful" });
    } catch (err) {
        console.error(err);
        logger.error('Error processing request:', err);
        res.status(403).json({ error: err, message: 'Something went wrong' });
    }
};


module.exports = {
    purchasepremium,
    updateTransactionStatus
};