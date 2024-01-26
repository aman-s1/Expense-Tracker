const User = require('../models/users');
const Expense = require('../models/expenses');
const sequelize = require('../util/database');

const logger = require('../logger');

const getuserLeaderBoard = async (req,res) => {
    try{
        const leaderboardUsers = await User.findAll({
            order: [['totalExpenses', 'DESC']]
        });
        console.log(leaderboardUsers);
        logger.info('Got LeaderBoard Array : Success');
        res.status(200).json(leaderboardUsers);
    } catch(err){
        console.log(err);
        logger.error('Error processing request:', err);
        res.status(500).json(err);
    }
}

module.exports = {
    getuserLeaderBoard
};