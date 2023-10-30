const express = require('express');
const mysql = require('mysql2');
const multer = require('multer');
const path = require('path');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const session = require('express-session');
const flash = require('express-flash');
const app = express();
const port = 3000;

const connection = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'gestionlv',
});

connection.connect((err) => {
    if (err) {
        console.error('Erreur de connexion à la base de données :', err);
    } else {
        console.log('Connexion à la base de données réussie');
    }
});

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'public/uploads');
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    },
});

const upload = multer({ storage: storage });

app.set('view engine', 'ejs');
app.use(express.urlencoded({ extended: false }));
app.use(express.static('public'));
app.use(flash());

app.use(session({ secret: 'votre_secret', resave: true, saveUninitialized: true }));
app.use(passport.initialize());
app.use(passport.session());

passport.use(new LocalStrategy(
    (username, password, done) => {
        connection.query('SELECT * FROM users WHERE username = ?', [username], (err, results) => {
            if (err) {
                return done(err);
            }
            if (results.length === 0) {
                return done(null, false, { message: 'Identifiants incorrects' });
            }
            const user = results[0];
            if (password !== user.password) {
                return done(null, false, { message: 'Identifiants incorrects' });
            }
            return done(null, user);
        });
    }
));

passport.serializeUser((user, done) => {
    done(null, user.id);
});

passport.deserializeUser((id, done) => {
    connection.query('SELECT * FROM users WHERE id = ?', [id], (err, results) => {
        if (err) {
            return done(err);
        }
        if (results.length === 0) {
            return done(null, false);
        }
        const user = results[0];
        done(null, user);
    });
});

const isAuthenticated = (req, res, next) => {
    if (req.isAuthenticated()) {
        return next();
    } else {
        res.redirect('/login');
    }
};

app.get('/', (req, res) => {
    if (req.isAuthenticated()) {
        connection.query('SELECT * FROM books', (err, results) => {
            if (err) {
                console.error('Erreur lors de la lecture des livres :', err);
                res.status(500).send('Erreur serveur');
            } else {
                res.render('book-list.ejs', { books: results });
            }
        });
    } else {
        res.redirect('/login');
    }
});

app.get('/add', isAuthenticated, (req, res) => {
    res.render('add-book.ejs');
});

app.post('/add', isAuthenticated, upload.single('cover_image'), (req, res) => {
    const { title, author, isbn, date, num_pages } = req.body;
    const cover_image = req.file ? `/uploads/${req.file.filename}` : null;

    connection.query('INSERT INTO books (title, author, isbn, date, num_pages, cover_image) VALUES (?, ?, ?, ?, ?, ?)', [title, author, isbn, date, num_pages, cover_image], (err) => {
        if (err) {
            console.error('Erreur lors de l\'ajout du livre :', err);
            res.status(500).send('Erreur serveur');
        } else {
            res.redirect('/');
        }
    });
});

app.get('/edit/:id', isAuthenticated, (req, res) => {
    const bookId = req.params.id;
    connection.query('SELECT * FROM books WHERE id = ?', [bookId], (err, results) => {
        if (err) {
            console.error('Erreur lors de la lecture du livre :', err);
            res.status(500).send('Erreur serveur');
        } else {
            res.render('edit-book.ejs', { book: results[0] });
        }
    });
});

app.post('/edit/:id', isAuthenticated, upload.single('cover_image'), (req, res) => {
    const bookId = req.params.id;
    const { title, author, isbn, date, num_pages } = req.body;
    const cover_image = req.file ? `/uploads/${req.file.filename}` : null;

    connection.query('UPDATE books SET title = ?, author = ?, isbn = ?, date = ?, num_pages = ?, cover_image = ? WHERE id = ?', [title, author, isbn, date, num_pages, cover_image, bookId], (err) => {
        if (err) {
            console.error('Erreur lors de la mise à jour du livre :', err);
            res.status(500).send('Erreur serveur');
        } else {
            res.redirect('/');
        }
    });
});

app.get('/delete/:id', isAuthenticated, (req, res) => {
    const bookId = req.params.id;
    connection.query('DELETE FROM books WHERE id = ?', [bookId], (err) => {
        if (err) {
            console.error('Erreur lors de la suppression du livre :', err);
            res.status(500).send('Erreur serveur');
        } else {
            res.redirect('/');
        }
    });
});

app.get('/login', (req, res) => {
    res.render('login');
});

app.post('/login', (req, res, next) => {
    const { username, password } = req.body;

    passport.authenticate('local', (err, user, info) => {
        if (err) {
            return next(err);
        }
        if (!user) {
            req.flash('error', 'Identifiants incorrects');
            return res.redirect('/login');
        }

        req.login(user, (loginErr) => {
            if (loginErr) {
                return next(loginErr);
            }
            return res.redirect('/');
        });
    })(req, res, next);
});

app.listen(port, () => {
    console.log(`Serveur écoutant sur le port ${port}`);
});
