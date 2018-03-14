var express = require('express');
var fs = require('fs');

// Tree containing project hierarchy
var treeStructure = require('./tree.json');
var z = 0;

// User clicked a node -> locate it in the tree
// and send itself + immediate ancestors
findClickedNode = (nodeID, root, callback) => {
    locateNode = (nodeID, node, callback) => {
        console.log('looking '+ String(z++));
        if (node.token === nodeID) {
            // Found it!
            callback(node);
            return 1;
        }
        if (!node.children)
            return; // Bottomed out
        for (var i=0;i<node.children.length;i++) {
            if (locateNode(nodeID, node.children[i], callback))
                return 1;
        }
    }
    locateNode(nodeID, root, (node) => {
        // Search complete
        if (!node.children)
            return; // This is a leaf. Browser shouldn't be reporting this!!
        // Create a deep copy of the tree to snip
        newTree = JSON.parse(JSON.stringify(node));
        // Snip off ancestors of clicked node's children
        for (var i=0;i<newTree.children.length;i++) {
            if (newTree.children[i].children) {
                delete newTree.children[i].children;
            }
        }
        callback(newTree);
    });
}

// Return stacks of opened nodes required to show all results
// Need to add feature to ignore duplicates
function getSearchStacks(phrase, callback) {
    function doSearch(phrase, node, stack, stackList) {
        // Check if node is candidate
        if ((node.name.toLowerCase().indexOf(phrase) !== -1)
            ||    ( (node.description) && (node.description.toLowerCase().indexOf(phrase) !== -1))) {
            // This node is a candidate
            if (foundNames.indexOf(node.name.toLowerCase()) === -1) {
                // This group is not already represented in the results. Add it in!
                foundNames.push(node.name.toLowerCase());
                stackList.push(JSON.parse(JSON.stringify(stack)));
            }
        }
        if (node.project === true) {
            // Bottomed out
            return;
        }
        for (var i = 0; i < node.children.length; i++) {
            stack.push(node.children[i].token);// stringify this if problematic
            doSearch(phrase, node.children[i], stack, stackList);
            stack.pop();
        }
    }
    var foundNames = []; // Use this to ignore previously found duplicates
    var root = JSON.parse(JSON.stringify(treeStructure));
    resultStacks = [] // Store paths to results in here
    doSearch(phrase, root, [root.name], resultStacks);
    callback(resultStacks);
}

function openSearchedNodes(stackList) {
    // Determine unique nodes to open by name
    nodesToOpen = []
    stackList.forEach(function (d) {
        d.forEach(function (r) {
            if (nodesToOpen.indexOf(r) == -1) {
                nodesToOpen.push(r);
            }
        })
    });

    // Open the tree back up, only expanding branches containing results
    function keepRelevantNodes(node) {
        // If this node has children
        if (!(node.children === null) && !(node.children === undefined)) {
            var keepChildren = false;
            // Check each child for relevancy
            for (var i = 0; i < node.children.length; i++) {
                if (nodesToOpen.indexOf(node.children[i].token) !== -1 && node.project === false) {
                    // Signal this node has at least one relevant child
                    keepChildren = true;
                }
            }
            if (keepChildren === false) {
                // Node has no relevant children, remove its children and go back up
                node.children = null;
                return;
            } else {
                // Node has relevant children, look through each of them
                for (var i=0;i<node.children.length;i++) {
                    keepRelevantNodes(node.children[i]);
                }
            }
        }
        // If this is a relevant project, highlight it
        if ((nodesToOpen.indexOf(node.token) !== -1) && (node.project === true)) {
            node.highlight = true;
        } else {
            node.highlight = false;
        }
    }
    treeCopy = JSON.parse(JSON.stringify(treeStructure));
    // Remove all unnecessary nodes
    keepRelevantNodes(treeCopy);
    // Return pruned tree
    return treeCopy;
}

// Shuffle arrays to allow fairness across tags in search results
function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

var app  = express();
var ROOT = './public';

// Log all requests for debugging purposes
app.use("*", function(req, res, next){
    console.log(req.originalUrl);
    next();
});

app.get('/search/:phrase', function(req, res) {
    res.send(getSearchStacks(req.params.phrase, (stackList) => {
        res.send(JSON.stringify(openSearchedNodes(stackList)));
    })); // Should be sending tree structure pre-opened
});

// Request for tree nodes
app.get('/dat/:nodeID', function(req, res) {
    findClickedNode(+req.params.nodeID, treeStructure, (result) => {
        console.log(result);
        res.send(JSON.stringify(result));
    });
});

// Request recieved for main page
app.get('/', function(req, res){
    data = fs.readFileSync(ROOT + 'index.html');
});

// File server
app.use(express.static(ROOT));

app.listen(8080);
console.log('golden')