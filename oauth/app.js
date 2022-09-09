/**
* @author 
* @date 2022/09/09
* @description 主入口
*/
const http = require("http");
const router = require("../modules/router");
const { send } = require("../modules/config");
const url = require("url");
const path = require("path");
const axios = require("axios");
const child_process = require("child_process");
const uuid = require("uuid");
const { client_id, secret } = require("./config");

// const state = uuid.v3()
const state = "123";

const db_user = [{username: 'zhourh', password: '123', id: 1}]

const redis_session = {};

// 注册路由
// https://github.com/login/oauth/authorize?client_id=3b26d3a064a732ff3222&state=123
router.get("/", async function (req, res) {
  router.findStatic(req, res, "/login.html");
});

router.get("/oauth", async function (req, res) {
  res.statusCode = 302;
  // child_process.exec(`open https://github.com/login/oauth/authorize?client_id=${client_id}&state=${state}&redirect_uri=http://localhost:8080/oauth/callback`)
  res.setHeader(
    "Location",
    `https://github.com/login/oauth/authorize?client_id=${client_id}&state=${state}&redirect_uri=http://localhost:8080/oauth/callback`
  );
  res.end();
});

router.get("/oauth/callback", async function (req, res) {
  const { query } = req;
  const { code, state: callbackState } = query;
  if (callbackState !== state) {
    send(req, res, "502", "state码错误");
  }
  const { data = {} } = await axios.post(
    "https://github.com/login/oauth/access_token",
    {
      client_id: '3b26d3a064a732ff3222',
      client_secret: '407583b680b6fffadd11867e72084bb9b9785c22',
      code: code,
    },
    { headers: { accept: "application/json" } }
  );
  if (!data) {
    send(req, res, "502", "网络错误");
  }
  const { access_token } = data;
  console.log(access_token, "access_token====>");
  const {data: userInfo = {}} = await axios.get("https://api.github.com/user", {
    headers: {
      Authorization: `Bearer ${access_token}`,
    },
  });
  console.log(userInfo, "userInfo====>");


  res.statusCode = 302;
  res.setHeader("Location", `/authn?id=${userInfo.id}`);
  res.end();
});


router.get("/authn", async function (req, res) {
  const str = uuid.v4()
  res.setHeader('set-cookie', `token=${str}; httponly`)
  redis_session[str] = req?.query?.id;
  router.redirect(res, '/home')
});


router.get("/toLogin", async function (req, res) {
    const {username, password} = req.query
    if(!(username && password)){
        send(req, res, "502", "账号密码不能为空");
        return
    }
    const user = db_user.filter((item) => item.username === username)[0]
    if(user && user.password === password){
        const str = uuid.v4()
        res.setHeader('set-cookie', `token=${str}; httponly`)
        redis_session[str] = user.id;

        router.redirect(res, '/home')
        return
    }
    send(req, res, "502", "账号密码错误");
});


router.get("/login", async function (req, res) {
    router.findStatic(req, res, "/login.html");
});


router.get("/home", async function (req, res) {
    const cookie = req.headers.cookie || '';
    const session = cookie.match(/token=(.*?)($|;)/)?.[1]
    if(!(session && redis_session[session])){
        router.redirect(res, '/login')
        return
    }
    router.findStatic(req, res, "/index.html");
    return
});

http.createServer(router).listen(8080);
