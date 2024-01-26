const Sib = require('sib-api-v3-sdk');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcrypt');

require('dotenv').config();

const logger = require('../logger');

const User = require('../models/users');
const Forgotpassword = require('../models/forgotpassword');

const forgotpassword = async (req,res) => {
    try{
        const { email } = req.body;
        const user = await User.findOne({ where: {email}});
        if(user)
        {
            const id = uuidv4();
            user.createForgotpassword({ id, active: true })
                .catch(err => {
                    throw new Error(err)
                })
            const client = Sib.ApiClient.instance
            const apiKey = client.authentications['api-key']
            apiKey.apiKey = process.env.SB_API_KEY

            const tranEmailApi = new Sib.TransactionalEmailsApi()
            const sender = {
                email: 'amansuhag6014@gmail.com',
                name: 'Aman',
            }
            const receivers = [
                {
                    email: 'amansuhag6014@gmail.com',
                },
                {
                    email: email,
                },
            ]
            tranEmailApi
                .sendTransacEmail({
                    sender,
                    to: receivers,
                    subject: 'Reset Password Link',
                    textContent: `
                        Dear User,
                        This mail is sent to you in regarding the request you made to reset your Password.
                        `,
                    htmlContent: `
                        <h4>Dear User</h4>
                        <p>This mail is sent to you in regarding the request you made to reset your Password</p>
                        <a href="http://localhost:3000/password/resetpassword/${id}">click here</a>
                `,
                    params: {
                        role: 'Backend and Full stack',
                    },
                })
                .then(() => {
                    logger.info('Mail Sent To Reset Password : Success');
                    return res.status(202).json({ message: 'check your mail' })
                })
                .catch(console.log)
        }
        else{
            throw new Error('User doenot exist')
        }
    }catch(err){
        console.log(err)
        logger.error('Error processing request:', err);
        return res.json({ message: err,success: false});
    }
}

const resetpassword = (req, res) => {
    const id =  req.params.id;
    Forgotpassword.findOne({ where : { id }}).then(forgotpasswordrequest => {
        if(forgotpasswordrequest){
            forgotpasswordrequest.update({ active: false});
            res.status(200).send(`<html>
                                    <script>
                                        function formsubmitted(e){
                                            e.preventDefault();
                                            console.log('called')
                                        }
                                    </script>

                                    <form action="/password/updatepassword/${id}" method="get">
                                        <label for="newpassword">Enter New password</label>
                                        <input name="newpassword" type="password" required></input>
                                        <button>reset password</button>
                                    </form>
                                </html>`
                                )
            res.end()

        }
    })
}
const updatepassword = (req, res) => {

    try {
        const { newpassword } = req.query;
        const { resetpasswordid } = req.params;
        Forgotpassword.findOne({ where : { id: resetpasswordid }}).then(resetpasswordrequest => {
            User.findOne({where: { id : resetpasswordrequest.userId}}).then(user => {
                // console.log('userDetails', user)
                if(user) {
                    //encrypt the password

                    const saltRounds = 10;
                    bcrypt.genSalt(saltRounds, function(err, salt) {
                        if(err){
                            console.log(err);
                            throw new Error(err);
                        }
                        bcrypt.hash(newpassword, salt, function(err, hash) {
                            // Store hash in your password DB.
                            if(err){
                                console.log(err);
                                throw new Error(err);
                            }
                            user.update({ password: hash }).then(() => {
                                logger.info('Password Updated : Success');
                                res.status(201).json({message: 'Successfuly update the new password'})
                            })
                        });
                    });
            } else{
                return res.status(404).json({ error: 'No user Exists', success: false})
            }
            })
        })
    } catch(error){
        logger.error('Error processing request:', error);
        return res.status(403).json({ error, success: false } )
    }

}


module.exports = {
    forgotpassword,
    updatepassword,
    resetpassword
}