const path = require("path");
const fs = require("fs");
const url = require("url");
const { mimeJson } = require("../config");

/** 路由集合 */
let methodList = ["get", "post"];
let routerConfig = {
  exact: {},
  get: {},
  post: {},
};
// 结束点标记
const trieEnd = "#end#";
// 通配结束点标记
const trieAllAfterEnd = "#allend#";
// 通配符跳过标记
const trieNext = "#next#";

/** 路由回调 */
const router = (req, res) => {
  let urlParse = url.parse(req.url, true)
  req.query = urlParse.query;
  let pathname = urlParse.pathname;
  let method = req.method.toLowerCase();
  let api = null;
  let isNotMatch = false;
  if (routerConfig.exact?.[method]?.[pathname]) {
    api = routerConfig.exact[method][pathname];
    api.handler(req, res);
    return;
  }
  let current = routerConfig[method] || {};
  // 路径节点
  const pathArr = pathParse(pathname);
  for (let i = 0; i < pathArr.length; i++) {
    let pathItem = pathArr[i]; // 节点名
    // if (!pathItem) continue;
    const node = current[pathItem] || current[trieNext];
    if (!node) {
      isNotMatch = true
      break;
    }
    current = node;
  }
  let config = null;
  if (current[trieEnd]) config = current[trieEnd];

  if (config && !isNotMatch) {
    // 解析地址栏参数
    if (config.paramIndexList)
      req.params = PathParamParse(config.paramIndexList, pathArr);
    api = config;
    if (method !== "get") {
      let postData = "";
      req.on("data", (chunk) => {
        postData += chunk;
      });
      req.on("end", () => {
        req.body = postData;
        api.handler(req, res);
      });
      return;
    }
    api.handler(req, res);
    return;
  }
  // // 没匹配到url，去找静态文件
  findStatic(req, res, pathname);
};

/**
 * @desc 静态文件
 */
const findStatic = (req, res, pathname) => {
  const filePath = path.join(__dirname, "../static" + pathname);
  fs.readFile(filePath, function (err, data) {
    if (data) {
      let extname = path.extname(pathname);
      let mime = mimeJson[extname] || "text/html";
      res.writeHead(200, { "Content-Type": `${mime};charset="utf-8"` });
      res.end(data);
    } else {
      // 都没匹配到 - 404
      res.writeHead(404, { "Content-Type": 'text/html;charset="utf-8"' });
      res.end("404 Not Found");
    }
  });
};
/**
 * @desc 重定向
 */
const redirect = (res, url) => {
  res.statusCode = 302;
  // child_process.exec('open https://github.com/login/oauth/authorize?client_id=3b26d3a064a732ff3222&state=123')
  res.setHeader("Location", url);
  res.end();
};


/**
 * 解析路径参数
 * @param node      特里树节点
 * @param pathArr   路径/切片
 * @constructor
 */
const PathParamParse = (paramIndexList, pathArr) => {
  if (!paramIndexList) return;
  const params = {};
  for (let i = 0; i < paramIndexList.length; i++) {
    const p = paramIndexList[i];
    params[p.key] = pathArr[p.idx];
  }
  return params;
};

const pathParse = (path) => {
  if(typeof path !== 'string') return [];
  let pathArr = path.split("/");
  pathArr.shift();
  if(!pathArr[pathArr.length - 1]){
    pathArr.pop();
  }
  return pathArr
}

/** 统计路由 */
methodList.forEach((method) => {
  router[method] = function (path, handler) {
    let config = { method, path, handler };
    // 精确匹配路由集合
    if (!routerConfig.exact) routerConfig.exact = {};
    // 路径切片
    const pathArr = pathParse(path);
    // 不是精确匹配
    let isNotExact = false;
    let paramIndexList = [];
    let trie = routerConfig[method]
      ? routerConfig[method]
      : (routerConfig[method] = {});
    for (let i = 0; i < pathArr.length; i++) {
      let pathItem = pathArr[i];
      // if (!pathItem) continue;
      let match = pathItem.match(/^:(.*?)$/);
      // 路径节点通配符
      if (match || pathItem === "*") {
        pathItem = trieNext;
        isNotExact = true;
        if (match)
          // 记录路径变量所在的路径索引关系
          paramIndexList.push({ idx: i, key: match[1] });
      }
      // 处理有params的情况
      if (paramIndexList.length) config.paramIndexList = paramIndexList;
      if (pathItem === "**") {
        isNotExact = true;
        trie[trieAllAfterEnd] = config;
        break;
      }
      if (i === pathArr.length - 1) {
        if (!trie[pathItem]) trie[pathItem] = {};
        trie[pathItem][trieEnd] = config;
        break;
      }
      if (!trie[pathItem]) trie[pathItem] = {};
      trie = trie[pathItem];
    }
    if (!isNotExact) {
      if (!routerConfig.exact[method]) routerConfig.exact[method] = {};
      routerConfig.exact[method][path] = config;
    }
  };
});

router.findStatic = findStatic;
router.redirect = redirect;


module.exports = router;
