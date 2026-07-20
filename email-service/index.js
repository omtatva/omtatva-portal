const express = require("express");
const nodemailer = require("nodemailer");
const cors = require("cors");


const app = express();

app.use(cors());
app.use(express.json());


// HR Email SMTP setup

const transporter = nodemailer.createTransport({

host: "smtp.gmail.com",

port: 587,

secure: false,

auth: {

user: process.env.HR_EMAIL,

pass: process.env.HR_PASSWORD

}

});



app.post("/send-email", async(req,res)=>{


try{


const {
to,
employeeName,
leaveType,
status,
fromDate,
toDate,
approvedBy,
remarks

}=req.body;



await transporter.sendMail({

from:
`HR Department <${process.env.HR_EMAIL}>`,

to:to,

subject:
`Leave Request ${status}`,

text:

`
Hello ${employeeName},

Your ${leaveType} request
from ${fromDate} to ${toDate}

has been ${status}.

Approved By:
${approvedBy}

Remarks:
${remarks || "N/A"}

Regards,
HR Team
`

});


res.json({

success:true,
message:"Email sent"

});


}

catch(error){

console.log(error);

res.status(500).json({

success:false,
error:error.message

});

}


});



app.get("/",(req,res)=>{

res.send("Email Service Running");

});



const PORT = process.env.PORT || 8080;


app.listen(PORT,()=>{

console.log(
`Server running on ${PORT}`
);

});