reset = {};

width = $(window).width();
height = $(window).height();

// Groups larger than this are displayed as being this size
maxGroupSize = 1000;

// Number of characters before label is truncated
maxLabelSize = 12;

// Sets label height above node
labelHeight = -7;

// Node repulsion forces
defaultCharge = -100;
projectHoverCharge = -1000;
tagHoverCharge = -500;

// Rate of simulation movement decay
simulationAlpha = 0.1;

// Label font sizes
regFontSize = 7;
hoverFontSize = 9;

sizeScale = d3.scaleLinear()
    .domain([1, maxGroupSize])
    .range([4, 7]);

var svg = d3.select("#body").append("svg:svg")
    .attr("width", width)
    .attr("height", height)
    .attr("overflow", "visible!important")
    .attr("position", "absolute")
    .attr("transform", "translate(-350,0)scale(2,2)")
    .call(d3.zoom().on("zoom", function () {
        svg.attr("transform", d3.event.transform);
    })).append("g");

color = d3.scaleOrdinal(d3.schemeCategory10);

var view = svg.append("rect")
    .attr("class", "view")
    .attr("x", 0.5)
    .attr("y", 0.5)
    .attr("width", width * 4)
    .attr("height", height * 2)
    .attr("opacity", 0);

function treeToNode(treeNode, parentNode = null) {
    var x = 0, y = 0;
    if (parentNode) {
        x = parentNode.x;
        y = parentNode.y;
    }
    treeNode.x = x;
    treeNode.y = y;
    treeNode.id = treeNode.name;
    treeNode.group = 1;
    return treeNode;
}

// Add an introductory instruction to the visualization
var introMessage = svg.append("svg:g")
    .classed("intro-message", true)
    .classed("hint", true)
    .attr("transform", "translate(" + width / 2 + "," + ((height / 2) - 40) + ")")
    .style("opacity", 0);
introMessage.append("svg:text")
    .text("Click on the Categories node to begin exploring.")
    .attr("fill", "#999");
introMessage
    .transition()
    .delay(400)
    .duration(1500)
    .style("opacity", 1);

d3.json('data.json', function (error, graph) {
    nodes = [treeToNode(graph)];
    links = [];

    // Set up the network graph simulation
    var simulation = d3.forceSimulation(nodes)
        .force("charge", d3.forceManyBody().strength(defaultCharge))
        .force("link", d3.forceLink().id(function (d) { return d.token }).distance(50))
        .force("x", d3.forceX())
        .force("y", d3.forceY())
        .alphaTarget(0)
        .alphaDecay(0.01)
        .on("tick", ticked);

    // Add groups for displaying links and nodes
    var g = svg.append("g").attr("transform", "translate(" + width / 2 + "," + height / 2 + ")"),
        link = g.append("g").attr("stroke", "#000").attr("stroke-width", 1.5).selectAll(".link"),
        node = g.append("g").attr("stroke", "#fff").attr("stroke-width", 1.5).selectAll(".node");

    restart();

    // Call any time changes are made to the data
    function restart() {
        node = node.data(nodes, function (d) { return d.token; });
        node.exit().remove();

        node = node.enter()
            .append("g")
            .attr("class", "nodegroup")
            .append("text")
            // Truncate long names
            .text(function (d) {
                if (d.token === 0) 
                    return d.id;
                if (d.id.length > maxLabelSize)
                    return d.id.substr(0, maxLabelSize) + '...';
                else
                    return d.id;
            })
            .attr("y", labelHeight)
            .classed("label", true)
            .attr("fill", function (d) {
                if (d.project) {
                    return 'blue'
                } else {
                    return 'slategray'
                }
            })
            .select(function () { return this.parentNode; })
            .append("circle")
            // Handle long name mouseovers
            .on("mouseenter", function (d) {
                // Clamp the node in place while hovered
                d3.select(this)
                    .attr("cursor", "pointer");
                d.fx = d.x;
                d.fy = d.y;
                d3.select(this.parentNode)
                    .select("text")
                    .text(function (d) { return d.id })
                    // Increase size while hovered
                    .transition()
                    .duration(200)
                    .style("font-size", String(hoverFontSize) + "px");
                // Increase the charge of a node if hovered over
                simulation.force("charge", d3.forceManyBody().strength(function (d2, i) {
                    if (d2 != d)
                        return defaultCharge;
                    else {
                        return (d.project ? projectHoverCharge : tagHoverCharge);
                    }
                })).alpha(simulationAlpha);
                simulation.restart();
            })
            .on("mouseleave", function (d) {
                d.fx = null;
                d.fy = null;
                var t;
                if (d.id.length > maxLabelSize)
                    t = d.id.substr(0, maxLabelSize) + '...';
                else
                    t = d.id;
                d3.select(this.parentNode)
                    .select("text")
                    .text(t)
                    // Increase size while hovered
                    .transition()
                    .duration(200)
                    .style("font-size", String(regFontSize) + "px");
                // Reset the forces
                simulation.force("charge", d3.forceManyBody().strength(-100)).alpha(simulationAlpha);
                simulation.restart();
            })
            .attr("fill", function (d) {
                if (d.project) {
                    return color(d.id)
                } else {
                    return 'white'
                }
            })
            .attr("stroke-width", '1px')
            .attr("r", function (d) {
                // Set relative to group size. If tag, randomize
                if (d.size) {
                    return (d.size < maxGroupSize ? sizeScale(d.size) : 7);
                } else {
                    return (Math.random() * 3) + 4;
                }
            })
            .on('click', function (d, i) {
                // Hide the intro message if open
                introMessage
                    .transition()
                    .duration(500)
                    .style('opacity', 0);
                // A node has been clicked.
                if (d.open && !d.project) {
                    return;
                }
                d.open = true;
                if (!d.project) {
                    $.ajax('/dat/' + String(d.token), {
                        success: function (data) {
                            expandNodes(d, data);
                        }
                    });
                } else {
                    $(".project-info").modal('refresh');
                    // Populate modal with this group's properties
                    $(".project-info .project-name").html(d.id);
                    $(".project-info .description p").html(d.description);
                    $(".project-info .contrib-list").html(function () {
                        outer_list = ""
                        if (d.contributors) {
                            for (var i = 0; i < d.contributors.length; i++) {
                                outer_list += '<li><a href="https://gcconnex.gc.ca/profile/' + /*d.usernames[i]*/'placeholder' + '">' + d.contributors[i] + '</a></li>'
                            }
                        }
                        return outer_list;
                    })
                    // Need to generate links to the above contributors profiles
                    $(".project-info img").attr("src", "group_pictures/" + String(d.guid) + ".png");
                    $(".project-info").modal('show');
                    $(".project-info").modal({
                        closeable: true,
                        observeChanges: true,
                        detachable: true
                    });
                    $('#visit-project').off('click').on("click", function () {
                        window.location.href = 'https://gcconnex.gc.ca/groups/profile/' + String(d.guid);
                    });
                    $('#get-similar').off("click").on("click", function () {
                        getSimilars(d);
                        $(".project-info").modal('hide');
                    });
                }
            })

            .select(function () { return this.parentNode; })
            .merge(node);

        //    testing
        reset = function () {
            restart();
        }

        // Apply the general update pattern to the links.
        link = link.data(links, function (d) { return d.source.token + "-" + d.target.token; });
        link.exit().remove();
        link = link.enter()
            .append("line")
            .style("stroke", "#ccc")
            .merge(link);

        // Update and restart the simulation.
        try { simulation.nodes(nodes); } catch (e) { console.log(e); }
        try { simulation.force("link").links(links); } catch (e) { console.log(e); }
        try { simulation.alpha(simulationAlpha).restart(); } catch (e) { console.log(e); }
        // These keep breaking. Throw away errors for now!
    }

    function ticked() {
        node.attr("transform", function (d) { return 'translate(' + d.x + ',' + d.y + ')' })

        link.attr("x1", function (d) { return d.source.x; })
            .attr("y1", function (d) { return d.source.y; })
            .attr("x2", function (d) { return d.target.x; })
            .attr("y2", function (d) { return d.target.y; });
    }
});


// Handle requests for similar nodes
function getSimilars(d, final = false) {
    function accumulate(data) {
        success_reqs += 1;
        var dat = JSON.parse(data);
        if (dat)
            accu = accu.concat(JSON.parse(data));
        success_reqs === 2 ? addSimilarsToGraph(d, accu) : null;
    }
    // Keep track of both requests
    var success_reqs = 0;
    // Accumulate responses
    var accu = []
    // Make first call for similar nodes
    $.ajax({
        type: 'POST',
        url: "/similar",
        data: {
            token: d.token,
            similar_groups: d.similar_groups,
            network_graph: true,
            parent_nodes: d.parent_nodes
        },
        success: accumulate
    });
    // Make second call for parent nodes
    $.ajax({
        type: 'POST',
        url: "/parents",
        data: {
            parent_nodes: d.parent_nodes,
            thisNodeGuid: d.guid
        },
        success: accumulate
    });
}

function tagInGraph(node) {
    var token = false;
    for (var i = 0; i < nodes.length; i++) {
        if (nodes[i] && (nodes[i].id === node.name)) {
            token = nodes[i].token;
            console.log(token);
        }
    }
    return token;
}

function sendSearch() {
    introMessage
        .transition()
        .duration(500)
        .style('opacity', 0);
    var phrase = $("#search-box").val().toLowerCase(); // Grab the search term
    $.ajax('/search/' + phrase, {
        success: function (data) {
            showSearchResults(getLeaves(JSON.parse(data), searchResult = true));
        }
    });
}

function getLeaves(tree, searchResult = false) {
    function getLeavesInner(node) {
        if (node.project && node.highlight === true) {
            leafNodes.push(treeToNode(node));
            return;
        }
        if (!node.children)
            return;
        for (var i = 0; i < node.children.length; i++)
            getLeavesInner(node.children[i]);
    }
    leafNodes = [];
    getLeavesInner(tree);
    return leafNodes;
}

function showSearchResults(newNodes) {
    nodes = newNodes;
    links = [];
    // Need to iterate through each to find links
    for (var i = 0; i < nodes.length; i++) {
        for (var k = 0; k < nodes.length; k++) {
            if ((nodes[i].similar_groups.indexOf(nodes[k].guid) !== -1)
                || (nodes[k].similar_groups.indexOf(nodes[i].guid) !== -1)) {
                // This group is similar, create a link
                console.log('found similar')
                links.push({
                    source: nodes[i].token,
                    target: nodes[k].token,
                    value: 1
                });
            }
        }
    }
    reset();
}

// Add listeners for language changes
$('#eng-toggle').on('click', function () {
    changeLanguage("en");
});
$('#fr-toggle').on('click', function () {
    changeLanguage("fr");
});

// Called when user clicks the language toggle
function changeLanguage(newLang) {
    if (newLang === "en") {
        $('#search-blurb').text('Search for projects or groups');
        $('#search-button').text('Search');
        $('#title-text').html('<strong>GC</strong>connex Project Overlay');
        $('#name-tag').text('This page is fully open source. Check out the source code on Github!');
        $('#top-contributors-title').text('Top Contributors');
        $('#modal-back-button').text('Back');
        $('#visit-project').html('Visit project page <i class="checkmark icon"></i>');
        $('#project-description-title').text('Project description');
        $('#get-similar').text('Show groups with similar members');
        introMessage
            .selectAll('text')
            .text('Click on the Categories node to begin exploring.');
    } else {
        $('#search-blurb').text('Rechercher des groupes ou des projets');
        $('#search-button').text('recherche');
        $('#title-text').html('Superposition de projets de <strong>GC</strong>connex');
        $('#name-tag').text('Cette page est entièrement open source. Découvrez le code source sur Github!');
        $('#top-contributors-title').text('Meilleurs contributeurs');
        $('#modal-back-button').text('Retourner');
        $('#visit-project').html('Visiter le projet <i class="checkmark icon"></i>');
        $('#project-description-title').text('Description de projet');
        $('#get-similar').text('Groupes similaires');
        introMessage
            .selectAll('text')
            .text('Cliquez sur le noeud Catégories pour commencer à explorer.');
    }
}

// Called after data has been retrieved.
// Populates the visualization with received nodes.
function expandNodes(d, data) {
    data = JSON.parse(data);
    function callNext(index, children) {
        setTimeout(function () {
            // Check node is already present in the graph.
            // If so, just add a link between d and that node
            if (index >= children.length)
                return;
            var a = nodeInGraph(children[index]);
            if (a) {
                // Node is aleady in the graph, add a link to it
                links.push({
                    source: d.token,
                    target: a,
                    value: 2
                })
            } else {
                // Node is not in the graph
                if (!children[index])
                    return;
                nodes.push(treeToNode(children[index], d))
                links.push({
                    source: d.token,
                    target: children[index].token,
                    value: 1
                });

                let thisChild = treeToNode(children[index], d)
                // Connect to already existing groups
                // Iterate through other existing nodes looking for possible links
                for (var i = 0; i < nodes.length; i++) {
                    if (thisChild.parent_nodes && !nodes[i].similar_groups) {
                        // This node is a tag
                        if (thisChild.parent_nodes.indexOf(nodes[i].id) !== -1) {
                            links.push({
                                source: nodes[i].token,
                                target: thisChild.token,
                                value: 1
                            });
                            continue;
                        }
                    }
                    if (!nodes[i].similar_groups || !thisChild.similar_groups)
                        continue;
                    if ((thisChild.similar_groups.indexOf(nodes[i].guid) !== -1)
                        || (nodes[i].similar_groups.indexOf(thisChild.guid) !== -1)) {
                        links.push({
                            source: treeToNode(children[index], d).token,
                            target: nodes[i].token,
                            value: 1
                        });
                    }
                }
            }
            reset();
            callNext(++index, children)
        }, 100);
    }
    callNext(0, data.children);
}


function nodeInGraph(node) {
    var token = false;
    for (var i = 0; i < nodes.length; i++) {
        if (nodes[i] && nodes[i].project && (nodes[i].id === node.name)) {
            token = nodes[i].token;
            console.log(token);
        }
    }
    return token;
}

function addSimilarsToGraph(d, full_data) {
    // Remove trailing 0 if no results found
    if (full_data[full_data.length - 1] === 0)
        full_data.pop();

    for (var i = 0; i < full_data.length; i++) {
        console.log(full_data[i]);
    }
    function callNext(index, children) {
        setTimeout(function () {
            if (index >= children.length || children[index] == undefined)
                return;
            var a = nodeInGraph(children[index]);
            let thisChild = treeToNode(children[index], d);
            if (a) {
                links.push({
                    source: d.token,
                    target: a,
                    value: 1
                });
            } else {
                nodes.push(treeToNode(children[index], d))
                links.push({
                    source: d.token,
                    target: children[index].token,
                    value: 1
                });

                // Connect to already existing groups
                if (thisChild.project) {
                    for (var i = 0; i < nodes.length; i++) {
                        if (!nodes[i].similar_groups)
                            continue;
                        if ((thisChild.similar_groups.indexOf(nodes[i]) !== -1)
                            || (nodes[i].similar_groups.indexOf(thisChild.guid) !== -1)
                            || (thisChild.parent_nodes.indexOf(nodes[i].id) !== -1)) {
                            links.push({
                                source: treeToNode(children[index], d).token,
                                target: nodes[i].token,
                                value: 1
                            });
                        }
                    }
                }
            }
            reset();
            callNext(++index, children)
        }, 100);
    }
    callNext(0, full_data);
}