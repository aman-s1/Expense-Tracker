const Expense = require('../models/expenses');
const User = require('../models/users');
const sequelize = require('../util/database');

const logger = require('../logger');

const AWS = require('aws-sdk');

function uploadToS3(data, filename){
    const BUCKET_NAME = process.env.BUC_NAME;
    const IAM_USER_KEY = process.env.I_AM_USER_KEY;
    const IAM_USER_SECRET = process.env.I_AM_USER_SECRET;

    let s3bucket = new AWS.S3({
        accessKeyId: IAM_USER_KEY,
        secretAccessKey: IAM_USER_SECRET,
        //Bucket: BUCKET_NAME
    })

    var params = {
        Bucket: BUCKET_NAME,
        Key: filename,
        Body: data,
        ACL: 'public-read'
    }
    return new Promise((resolve,reject) => {
        s3bucket.upload(params, (err, s3response) => {
            if(err)
            {
                console.log('Something went Wrong');
                logger.error('Error processing request:', error);
                reject(err);
            }else{
                console.log('Success', s3response);
                resolve(s3response.Location);
            }
        })
    })
}

const downloadexpense = async (req, res) => {
    try {
        const expenses = await Expense.findAll({ where: { userId: req.user.id } });

        if (!expenses || expenses.length === 0) {
            return res.status(404).json({ error: 'No expenses found for the user', success: false });
        }

        const stringifiedExpenses = JSON.stringify(expenses);
        const userId = req.user.id;
        const filename = `Expenses${userId}/${new Date().toISOString()}.txt`;
        
        const fileURL = await uploadToS3(stringifiedExpenses, filename);
        logger.info('Download Expense : Success.');
        res.status(200).json({ fileURL, success: true });
    } catch (error) {
        console.error(error);
        logger.error('Error processing request:', error);
        res.status(500).json({ fileURL: '', success: false , err: 'Internal Servaer Error'});
    }
};

function isstringInvalid(string){
    if(string == undefined || string.length === 0)
    {
        return true;
    }
    else{
        return false;
    }
}

const addexpense = async (req, res) => {
    const t = await sequelize.transaction();

    const { expenseamount, description, category } = req.body;

    try {
        // Validate expense amount
        if (expenseamount === undefined || expenseamount <= 0) {
            return res.status(400).json({ err: 'Expense Amount is Missing or Invalid' });
        }

        // Validate description and category
        if (isstringInvalid(description) || isstringInvalid(category)) {
            return res.status(400).json({ err: 'Empty Parameters for Description or Category' });
        }

        // Create an expense record
        const createdExpense = await Expense.create({
            expenseamount,
            description,
            category,
            userId: req.user.id,
        }, { transaction: t });

        // Update total expenses for the user
        const totalExpense = Number(req.user.totalExpenses) + Number(expenseamount);
        await User.update(
            {
                totalExpenses: totalExpense,
            },
            {
                where: { id: req.user.id },
                transaction: t,
            }
        );

        await t.commit(); 
        logger.info('Expense Added : Success.');
        res.status(201).json({ expense: createdExpense });
    } catch (err) {
        console.error(err);
        logger.error('Error processing request:', err);
        await t.rollback(); 
        return res.status(500).json({ err: 'Failed to add expense' });
    }
};

const getexpenses = async (req, res) => {
    try {

        const page = req.query.page || 1;
        const pageSize = req.query.pageSize || 7;

        // Check if page and pageSize are valid numbers
        if (isNaN(page) || isNaN(pageSize) || page <= 0 || pageSize <= 0) {
            return res.status(400).json({ error: 'Invalid page or pageSize values' });
        }

        const expenses = await Expense.findAll({
            where: { userId: req.user.id },
            offset: (page - 1) * pageSize,
            limit: parseInt(pageSize),
        });
        logger.info('Got Expenses : Success');
        return res.status(200).json({ expenses });
    } catch (error) {
        logger.error('Error processing request:', error);
        return res.status(500).json({ error: error.message || 'Internal Server Error' });
    }
};


const deleteexpense = async (req, res) => {
    const t = await sequelize.transaction();

    try {
        const expenseid = req.params.expenseid;

        if (expenseid == undefined || expenseid.length === 0) {
            await t.rollback();
            return res.status(400).json({ err: 'Parameters Missing' });
        }

        const expense = await Expense.findByPk(expenseid);
        const user = await User.findByPk(req.user.id);

        if (!expense) {
            await t.rollback();
            return res.status(404).json({ message: 'Expense not found' });
        }

        const totalExpenses = user.totalExpenses - expense.expenseamount;

        await Expense.destroy({ where: { id: expenseid, userId: req.user.id }, transaction: t });

        await User.update(
            {
                totalExpenses: totalExpenses,
            },
            {
                where: { id: req.user.id },
                transaction: t,
            }
        );

        await t.commit();
        logger.info('Expense Deleted : Success');
        return res.status(200).json({ message: 'Deleted Successfully' });
    } catch (err) {
        console.log(err);
        logger.error('Error processing request:', err);
        await t.rollback();
        return res.status(500).json({ message: 'Failed' });
    }
};



const getExpenseSum = async (req, res) => {
    try {
        const userId = req.user.id;
        const user = await User.findByPk(userId);
        
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        logger.info('Got Expense Sum : Success');
        res.status(200).json({ sum: user.totalExpenses });
    } catch (error) {
        logger.error('Error processing request:', error);
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};


const getExpensesByCategory = async (req, res) => {
    try {
        const userId = req.user.id;

        const expensesByCategory = await Expense.findAll({
            attributes: ['category', [sequelize.fn('sum', sequelize.col('expenseamount')), 'sum']],
            where: { userId },
            group: ['category'],
        });
        logger.info('Got Expenses By Category : Success');
        res.status(200).json({ expenses: expensesByCategory });
    } catch (error) {
        logger.error('Error processing request:', error);
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

module.exports = {
    addexpense,
    getexpenses,
    deleteexpense,
    getExpenseSum,
    getExpensesByCategory,
    downloadexpense
};