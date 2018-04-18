var nodeOffset = 30;
var nodeTextSize = '12px';

var m = [20, 120, 20, 80],
    w = 1280 - m[1] - m[3],
    h = 800 - m[0] - m[2],
    i = 0;

var root;

var tree = d3.layout.tree()
    .size([h, w]);

var diagonal = d3.svg.diagonal()
    .projection(function (d) { return [d.y, d.x]; });

var vis = d3.select("#body").append("svg:svg")
    .attr("width", w + m[1] + m[3])
    .attr("height", h + m[0] + m[2])
    .style('overflow', 'visible')
    .classed("vis-container", true)
    .call(d3.behavior.zoom().on("zoom", function() {
        correctTranslation = [d3.event.translate[0] + m[3], d3.event.translate[1] + m[0]];
        vis.attr("transform", "translate(" + correctTranslation + ")" + " scale(" + d3.event.scale + ")")
    }))
    .append("svg:g")
    .attr("transform", "translate(" + m[3] + "," + m[0] + ")");
    
var backRect = vis.append("rect")
    .attr("width", w *4)
    .attr("height", h + m[0] + m[2])
    .attr('x', -w*2)
    .style("fill", "none")
    .style("pointer-events", "all");

// Define the div for the tooltip
var ttip = d3.select("body").append("div")
    .attr("class", "tooltip")
    .style("opacity", 0);

// Add an introductory instruction to the visualization
var introMessage = vis.append("svg:g")
    .classed("intro-message", true)
    .classed("hint", true)
    .attr("transform", "translate(" + -80 + ", " + ((h / 2) - 20) + ")")
    .style("opacity", 0);
introMessage.append("svg:text")
    .text("Click on the Categories node to begin exploring.")
    .attr("fill", "#999");
introMessage
    .transition()
    .delay(400)
    .duration(1500)
    .style("opacity", 1);

function toggleAll(d) {
    if (d.children) {
        d.children.forEach(toggleAll);
        toggle(d);
    }
}

d3.json("data.json", function (json) {
    root = json;
    root.x0 = h / 2;
    root.y0 = 1200;
    
    // Close the tree to begin with
    toggleAll(root);
    update(root);
});

function update(source) {
    var duration = d3.event && d3.event.altKey ? 5000 : 500;

    // Compute the new tree layout
    var nodes = tree.nodes(root).reverse();

    // Normalize for fixed-depth
    nodes.forEach(function (d) { d.y = (d.depth * 180)+nodeOffset; });

    // Update the nodes
    var node = vis.selectAll("g.node")
        .data(nodes, function (d) { return d.id || (d.id = ++i); });

    // Enter any new nodes at the parent's previous position.
    var nodeEnter = node.enter().append("svg:g")
        .attr("class", "node")
        .attr("transform", function (d) { return "translate(" +(source.y0) + "," + source.x0 + ")"; })
        .on("mouseup", function (d) {
            
            if (!d.project) {
                // Remove any instance of similarity lines
                d3.selectAll(".sim-line")
                    .transition()
                    .duration(300)
                    .attr("opacity", 0);
            }
                
            // Ask for this node's children if it is closed
            if (!d.project && !d.children) {
                console.log('sending request for node token '+ d.token);
                $.ajax('/dat/'+d.token,
                    {
                        success: function (data) {
                            // Append child nodes onto d
                            data = JSON.parse(data);
                            console.log(data);
                            d.children = null;
                            d._children = data.children;
                            toggle(d);
                            update(d);
                        }
                    });
            } else {
                // If d is already open just close it
                toggle(d);
                update(d);
            }
        });
    
    // Add a circle for each new incoming node
    nodeEnter.append("svg:circle")
        .attr("r", 1e-6) //1e-6
        .style("fill", function (d) { return !d.project ? "lightsteelblue" : "#fff"; });

    // Add a label for each new node. Projects also get the ability to open modals
    nodeText = nodeEnter.append('a')
        .append("svg:text");
    nodeText
        .attr("x", function (d) { return d.project ? 10 : -10; })
        .attr("dy", ".35em")
        .attr("text-anchor", function (d) { return d.project ? "start" : "end"; })
        .text(function (d) { return clean_name_for_svg(d.name); })
        .style('fill', function (d) {
            return d.project ? 'steelblue' : 'black';
        })
        .classed("proj-text", function (d) {
            return d.project ? true : false;
        })
        .on("mouseup", function (d) {
            // Hide the intro message upon interaction
            introMessage
                .transition()
                .duration(500)
                .style('opacity', 0);
            // Check if this is a project (if so, launch a modal)
            if (d.project === true) {
                $(".project-info").modal('refresh');
                // Populate modal with this group's properties
                $(".project-info .project-name").html(d.name);
                $(".project-info .description p").html(d.description);
                $(".project-info .contrib-list").html(function() {
                    outer_list = ""
                    if (d.contributors) {
                        for (var i=0;i<d.contributors.length;i++) {
                            outer_list += "<li>"+d.contributors[i]+"</li>"
                        }
                    }
                    return outer_list;
                })
                $(".project-info img").attr("src","group_pictures/"+String(d.guid)+".png");
                $(".project-info").modal('show');
                $(".project-info").modal({
                    closeable: true,
                    observeChanges: true,
                    detachable: true
                });
                $('#visit-project').off('click').on('click', function() {
                    window.location.href='https://gcconnex.gc.ca/groups/profile/' + String(d.guid);
                });
                // Remember: remove previous handler before adding a new one
                $('#get-similar').off("click").on("click", function() {
                    // Remove any instance of similarity lines
                    d3.selectAll(".sim-line")
                        .transition()
                        .duration(300)
                        .attr("opacity", 0);
                    $(".project-info").modal('hide');
                    // Get tree containing similar groups + links
                    $.ajax({
                        type: "POST",
                        url: "/similar",
                        data: {
                            token: d.token,
                            similar_groups: d.similar_groups
                        },
                        success: function(data) {
                            openSearchResults(data, function() {
                                // Perform search through the tree for similars + origin
                                sims = findSimilars()
                                setTimeout(function() {
                                    var simGroup = vis.append("g")
                                        .classed("sim-group", true);
                                        console.log('new data received:')
                                    console.log(d);
                                    function callNext(index, children) {
                                        setTimeout(function() {
                                            // Draw the arc between d and m
                                            // calculate midpoints
                                            var midX = (sims.origin.x + children[index].x) / 2;
                                            var midY = sims.origin.y +100;
                                            simGroup.append("path")
                                                .classed("sim-line", true)
                                                .attr("d", "M"+sims.origin.y+' '+sims.origin.x+
                                                    ' Q '+400 +' '+ midX +' '+children[index].y+' '+children[index].x)
                                                .attr("stroke", "gray")
                                                .attr("stroke-dasharray", "5,5")
                                                .attr("fill", "transparent")
                                                .attr("stroke-width", 2)
                                                .attr("opacity", 0)
                                                .transition()
                                                .duration(1000)
                                                .attr("opacity", 1);
                                            if (++index < children.length)
                                                callNext(index, children);
                                        }, 100)
                                    }
                                    callNext(0, sims.similars)
                                }, 400)// Iterate through array drawing connections
                            });
                        } 
                    });
                })
            }
        })
        .style("fill-opacity", 1e-6)
        .style("cursor", "pointer");

    // Transition nodes to their new position.
    var nodeUpdate = node.transition()
        .duration(duration)
        .attr("transform", function (d) { return "translate(" + d.y + "," + d.x + ")"; });
    
    nodeUpdate.select("circle")
        .attr("r", 6)
        .style("fill", function (d) { return ((!d.children) && (!d.project)) ? "lightsteelblue" : "#fff"; });

    nodeUpdate.select("text")
        .style("fill-opacity", 1);

    // Handle search results
    nodeUpdate.select("text")
        .style("fill", function (d) {
            if (d.highlight === true) {
                return 'red';
            } else if (d.project === true) {
                return 'steelblue';
            } else {
                return 'black';
            }
        });

    // Transition exiting nodes to the parent's new position.
    var nodeExit = node.exit().transition()
        .duration(duration)
        .attr("transform", function (d) { return "translate(" + source.y + "," + source.x + ")"; })
        .remove();

    nodeExit.select("circle")
        .attr("r", 1e-6);

    nodeExit.select("text")
        .style("fill-opacity", 1e-6);

    // Update the links
    var link = vis.selectAll("path.link")
        .data(tree.links(nodes), function (d) { return d.target.id; });

    // Enter any new links at the parent's previous position.
    link.enter().insert("svg:path", "g")
        .attr("class", "link")
        .attr("d", function (d) {
            var o = { x: source.x0, y: (source.y0) };
            return diagonal({ source: o, target: o });
        })
        .transition()
        .duration(duration)
        .attr("d", diagonal);

    // Transition links to their new position.
    link.transition()
        .duration(duration)
        .attr("d", diagonal);

    // Transition exiting nodes to the parent's new position.
    link.exit().transition()
        .duration(duration)
        .attr("d", function (d) {
            var o = { x: source.x, y: source.y };
            return diagonal({ source: o, target: o });
        })
        .remove();

    // Stash the old positions for transition.
    nodes.forEach(function (d) {
        d.x0 = d.x;
        d.y0 = d.y;
    });
}

// Toggle children.
function toggle(d) {
    if (d.children) {
        d._children = d.children;
        d.children = null;
    } else {
        d.children = d._children;
        d._children = null;
    }
}

function sendSearch() {
    // Remove any instance of similarity lines
        d3.selectAll(".sim-line")
            .transition()
            .duration(300)
            .attr("opacity", 0);
        var phrase = $("#search-box").val().toLowerCase(); // Grab the search term
        $.ajax('/search/'+phrase, {
            success: openSearchResults
        })
}

// Find origin and all similar. 
function findSimilars() {
    function findSimilarsInner(node) {
        if (node.origin) {
            origin = node;
        } else if (node.similar) {
            similars.push(node);
        }
        if (!node.children)
            return; // Bottomed out
        for (var i=0;i<node.children.length;i++) {
            findSimilarsInner(node.children[i]);
        }
    }
    var origin;
    var similars = [];
    findSimilarsInner(root);
    return {
        origin: origin,
        similars: similars
    };
}

function openSearchResults(newTree, callback = null) {
    // Hide the intro message upon interaction
    introMessage
        .transition()
        .duration(500)
        .style('opacity', 0);
    hideIntro();
    toggleAll(root);
    update(root);
    console.log(JSON.parse(newTree));
    setTimeout(function () {
        root = JSON.parse(newTree);
        // Add root coordinate adjustments
        root.x0 = h / 2;
        root.y0 = 0;
        update(root);
        if (callback) callback();
    }, 1000);
}

function hideIntro() {
    introMessage
        .transition()
        .duration(500)
        .style('opacity', 0);
    $('.footer').attr('opacity', 0);
}

// Add listeners for language changes
$('#eng-toggle').on('click', function() {
    changeLanguage("en");
});
$('#fr-toggle').on('click', function() {
    changeLanguage("fr");
});

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

// Clean out html for the group names
function clean_name_for_svg(txt) {
    return txt.replace("&#039;", "'");
}