const bcrypt = require('bcrypt');
const saltRounds = 10;
const jwt = require('jsonwebtoken');

const logger = require('../logger');

const User = require('../models/users');

function isstringInvalid(string){
    if(string == undefined || string.length === 0)
    {
        return true;
    }
    else{
        return false;
    }
}
const signup = async (req, res) => {
    const { name, email, password } = req.body;

    if (isstringInvalid(name) || isstringInvalid(email) || isstringInvalid(password)) {
        return res.status(400).json({ err: 'Empty Parameters' });
    }

    try {
        const existingUser = await User.findOne({ where: { email } });

        if (existingUser) {
            return res.status(400).json({ err: 'User with this email already exists' });
        }

        const hashedPassword = await bcrypt.hash(password, saltRounds);

        await User.create({ name, email, password: hashedPassword, ispremiumuser: 'false'});
        logger.info('Sign Up : Success');
        res.status(201).json({ message: 'Successfully Created new User' });
    } catch (err) {
        logger.error('Error processing request:', err);
        res.status(500).json(err);
    }
};

function generateAccessToken(id, name) {
    return jwt.sign({ userId: id , name: name}, '6b64e201b0e7ec99dfce661f082aef021e71468d97966944a694ae0101e7319b');
}

const login = async (req, res) => {
    const { email, password } = req.body;

    try {
        if (!email || !password) {
            return res.status(400).json({ err: 'Email and password are required' });
        }

        const user = await User.findOne({ where: { email } });

        if (!user) {
            return res.status(404).json({ err: 'User does not exist' });
        }

        const match = await bcrypt.compare(password, user.password);

        if (!match) {
            return res.status(401).json({ err: 'User not authorized' });
        }
        
        const token = generateAccessToken(user.id, user.name);
        console.log('Token:', token);
        logger.info('Login : SuccessS');
        res.status(200).json({ message: 'Login successful', token });
    } catch (err) {
        logger.error('Error processing request:', err);
        res.status(500).json(err);
    }
};


module.exports = {
    signup,
    login,
    generateAccessToken
};