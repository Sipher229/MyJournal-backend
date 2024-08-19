import express, { response } from "express"
import bodyParser from "body-parser"
import cors from "cors"
import pg from "pg"
import "dotenv/config"
import bcrypt from "bcrypt"
import session from "express-session"
import passport from "passport"
import { Strategy } from "passport-local"

const app = express()
const port = 5000
const saltRounds = 10

const db = new pg.Client({
    user: "postgres",
    host: "localhost",
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: 5432
})

db.connect()


app.use(bodyParser.urlencoded({extended: true}))

app.use(express.json())

app.use(cors({
    origin: 'http://localhost:5173',
    credentials: true,
    optionSuccessStatus: '200',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    
}))

app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
    cookie: {
        maxAge: 3 * 3600 * 1000
    }
}))

app.use(passport.initialize())
app.use(passport.session())

// app.options('*', cors())
// -----------------------------------register route---------------------------------

app.post("/register", (req, res) => {
    console.log("register route!")
    const {username, password} = req.body
    const qry = "INSERT INTO Users(username, password) VALUES ($1, $2)"
    try{
        bcrypt.hash(password, saltRounds, (err, hash) => {
            
            db.query(qry,[username, hash],(err, result)=>{
                if(err) {
                    return res.json({
                        success: false,
                        message: err.message,
                        isLoggedIn: false
                    })
                }
                req.logIn({username: username, password: password},(error)=>{
                    if(error){
                        console.log(error.message)
                    }
                    // req.session.save(() => {
                    //     // save session
                    // })

                    // if(req.user){
                    //     res.setHeader("Access-Control-Allow-Credentials", "true")
                        
                    // }
                    res.redirect('/getcontent')

                })
            })
        })
    }catch(e){

        res.json({
            success: false,
            message: e.message
        })

    }
})



// -------------------------------- login route ------------------------------------

app.post("/login", passport.authenticate("local", {
    successRedirect: "/getcontent",
    failureRedirect: "/notauthorised"
}))



// (req, res) =>{
//     if(req.user){
//         res.setHeader('Access-Control-Allow-Credentials', 'true')
//         return res.redirect("/getcontent")
//     }
//     return res.redirect("/notauthorised")
// }
passport.use (new Strategy( async function verify(username, password, cb){

    const qry = "SELECT * FROM Users WHERE username = $1"
    
    try{
        const response = await db.query(qry, [username])
        if(response.rows.length !== 0){
            
            bcrypt.compare(password, response.rows[0].password, (err, result)=>{
                if(err){
                    throw new Error("Errow while comparing with bcrypt")
                }
                if(result){
                    cb(null, response.rows[0])
                 
                }else{
                    // res.json({
                    //     status: 400,
                    //     success: false,
                    //     message: "wrong password"
                    // })
                    cb(null, false)
                }
            })
        }else {
            // res.json({
            //     status: 400,
            //     success: false,
            //     message: "wrong email"
            // })
            cb(null, false)
        }
    } catch(e){
        // res.json({
        //     status: 500,
        //     success: false,
        //     message: e.message
        // })
        console.log(e.stack)
    }

}))

passport.serializeUser((user, cb)=>{
    cb(null, user)
})
passport.deserializeUser((user, cb) => {
    cb(null, user)
})


// ------------------------------- add content ----------------------------------------------

app.post("/add", (req, res) =>{
    console.log("add route!")
    if (!req.isAuthenticated()){
        return res.json({
            success: false,
            message: "not authenticated",
            status: 400
        })
    }
    const {title, content, userId} = req.body
    const time = new Date()
    const date = `${time.getMonth()+1}/${time.getDate()}/${time.getFullYear()}`
    const qry = "INSERT INTO Notes(title, content, date, userId) VALUES($1, $2, $3, $4)"
    try{
        db.query(qry, [title, content, date, userId], (err, result) => {
            if (err){
                return res.json({
                    success: false,
                    message: err.message,
                    isLoggedIn: false
                })
            }
            return res.redirect("/getcontent")
        })

    }catch(e){
        console.log(e.message)
        res.json({
            success: false,
            message: e.message,
            status: 500,
        })

    }
})

//----------------------------------------------- get content ----------------------------------
app.get("/getcontent", (req, res) => {
    console.log("getcontent route!")
    console.log(req.user)
    // console.log(req.isAuthenticated())
    if (!req.isAuthenticated()){
        return res.json({
            success: false,
            message: "not authenticated",
            isLoggedIn: false
        })
    }
    const {username} = req.user
    const qry = "SELECT * FROM users INNER JOIN notes ON users.id = notes.userid WHERE username = $1"
    try {
        db.query(qry, [username], (err, result) => {
            if (err) {
                console.log(err.message)
                return res.json({
                    success: false,
                    message: err.message,
                    isLoggedIn: false
                })
            }
            console.log(result.rows)
            return res.json({
                success: true,
                message: "retrieved data successfully",
                isLoggedIn: true,
                notes: result.rows,
                username: req.user.username,
                userId: req.user.id,
            })
        })
    } catch (error) {
        res.json({
            message: error.message,
            success: false,
            notes: null,
            isLoggedIn: true,
        })
    }
})

// ----------------------------------------------------- not authorized -----------------------------------
app.get("/notauthorised", (req, res) => {
    return res.json({
        success: false,
        message: "User not authorized",
        isLoggedIn: false,
    })
})

// ------------------------------------------------------- edit content ----------------------------------------

app.patch("/edit", (req, res) => {
    console.log("edit route!")
    if (!req.isAuthenticated()){
        return res.json({
            success: false,
            message: "not authenticated",
            isLoggedIn: false
        })
    }

    const {title, content, id} = req.body
    const qry = "UPDATE Notes SET title= $1, content= $2 WHERE id = $3"

    try {
        db.query(qry, [title, content, parseInt(id)], (err, result) => {
            if (err){
                console.log(err.message)
                return res.json({
                    success: false,
                    message: err.message,
                    isLoggedIn: false
                })
            }
            // console.log(req.body)
            return res.json({
                success: true,
                message: "edited data successfully",
                isLoggedIn: true
            })
        })
    } catch(error) {
        res.json({
            message: error.message,
            success: false,
            isLoggedIn: true,
        })
    }

})

// -------------------------------------------------- delete content ----------------------------------

app.delete("/delete/:id", (req, res) => {
    console.log("delete route!")
    if (!req.isAuthenticated()){
        return res.json({
            success: false,
            message: "not authenticated",
            isLoggedIn: false
        })
    }
    const notedId = req.params.id 
    const qry = "DELETE FROM Notes WHERE id = $1"

    try {
        db.query(qry, [notedId], (err, result)=> {
            if(err){
                console.log(err.message)
                res.json({
                    success: false,
                    message:"Database error: "  + err.message,
                    isLoggedIn: false
                })
            }
            return res.json({
                success: true,
                message: "deleted data successfully",
                isLoggedIn: true
            })
        })
    } catch(error){
        res.json({
            message: error.message,
            success: false,
            isLoggedIn: true
        })
    }
})

//--------------------------------------------------- log out -------------------------------
app.delete("/logout", (req, res) => {
    if(req.isAuthenticated()){
        return req.logOut((err)=>{
            if (err) {
                return res.json({
                    message: "failed to log out",
                    success: false,
                    isLoggedIn: true
                })
            }
            return res.json({
                message: "logged out successfully",
                success: true,
                isLoggedIn: false,
            })
        })
    }
    return res.json({
        message: "logged out successfully",
        success: true,
        isLoggedIn: false,
    })
})

app.listen(port, () => {
    console.log(`listening on port ${port}`)
})


    // console.log("login route!")
    // const qry = "SELECT email, password FROM Users WHERE email = $1"
    
    // try{
    //     const response = await db.query(qry, [req.body.username])
    //     if(response.rows.length !== 0){
    //         const {email, password} = response.rows[0]
    //         bcrypt.compare(req.body.password, password, (err, result)=>{
    //             if(err){
    //                 throw new Error("error while comparing: " + err.message)
    //             }
    //             if(result){
    //                 res.json({
    //                     status: 200,
    //                     success: true,
    //                     message: "Successful"
    //                 })
    //             }else{
    //                 res.json({
    //                     status: 400,
    //                     success: false,
    //                     message: "wrong password"
    //                 })
    //             }
    //         })
    //     }else {
    //         res.json({
    //             status: 400,
    //             success: false,
    //             message: "wrong email"
    //         })
    //     }
    // } catch(e){
    //     res.json({
    //         status: 500,
    //         success: false,
    //         message: e.message
    //     })
    //     console.log(e.stack)
    // }