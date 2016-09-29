// Headstart
// filename: headstart.js

"use strict";
import StateMachine from 'javascript-state-machine';

import config from 'config';

import { mediator } from 'mediator';
import { BubblesFSM } from 'bubbles';
import { papers } from 'papers';
import { list } from 'list';

import { intro, intro_cn3, intro_plos } from 'intro';
import { getRealHeight } from "helpers";
import { BrowserDetect } from "helpers";

const timelineTemplate = require('templates/timeline.handlebars');
const headstartTemplate = require("templates/headstart.handlebars");
const infoTemplate = require("templates/misc/info_modal.handlebars");
const iFrameTemplate = require("templates/misc/iframe_modal.handlebars");
const imageTemplate = require("templates/misc/images_modal.handlebars");

import 'hypher';
import 'lib/en.js';
import 'dotdotdot';

export var headstart;
export var HeadstartFSM = function() {
    this.VERSION = 2.9;

    // Load default config + local settings and extend headstart object
    Object.assign(this, config, data_config);

    // Build Headstart skeleton
    this.viz = $("#" + this.tag);
    this.viz.addClass("headstart");

    this.viz.append(headstartTemplate());
    this.viz.append(infoTemplate());
    this.viz.append(iFrameTemplate());
    this.viz.append(imageTemplate());

    // contains bubbles objects for the timline view
    // elements get added to bubbles by calling registerBubbles()
    // this.bubbles = {};

    this.current_zoom_node = null;
    this.current_enlarged_paper = null;
    this.current_file_number = 0;
    this.current_circle = null;
    this.papers_list = null;
    this.circle_zoom = 0;
    this.is_zoomed = false;
    this.zoom_finished = false;
}; // end HeadstartFSM constructor

HeadstartFSM.prototype = {

    // prototype methods
    checkBrowserVersions: function() {
        var browser = BrowserDetect.browser;

        if (browser !== "Firefox" && browser !== "Safari" && browser !== "Chrome") {
            alert("You are using an unsupported browser. This visualization was successfully tested with the latest versions of Chrome, Safari, Opera and Firefox.");
        }
    },

    recordAction: function(id, action, user, type, timestamp, additional_params, post_data) {

        if (!this.is_evaluation) {
            return;
        }

        timestamp = (typeof timestamp !== 'undefined') ? (escape(timestamp)) : ("");
        additional_params = (typeof additional_params !== 'undefined') ? ('&' + additional_params) : ("");
        if (typeof post_data !== 'undefined') {
            post_data = { post_data: post_data };
        } else {
            post_data = {};
        }

        let php_script = this.server_url + "services/writeActionToLog.php";

        $.ajax({
            url: php_script +
                '?user=' + user +
                '&action=' + action +
                '&item=' + escape(id) +
                '&type=' + type +
                '&item_timestamp=' + timestamp + additional_params + '&jsoncallback=?',
            type: "POST",
            data: post_data,
            dataType: "json",
            success: function(output) {
                console.log(output);
            }
        });
    },



    calcChartSize: function() {
        var parent_height = getRealHeight($("#" + this.tag));
        var subtitle_heigth = $("#subdiscipline_title").outerHeight(true);

        if (parent_height === 0) {
            this.available_height = Math.max(document.documentElement.clientHeight, window.innerHeight || 0) - subtitle_heigth;
        } else {
            this.available_height = $("#" + this.tag).height() - subtitle_heigth;
        }

        this.available_height = this.available_height - 1;

        if (this.is("timeline")) {
            var timeline_height = $(".tl-title").outerHeight(true);
            this.available_height = this.available_height - timeline_height;
            this.available_width = $("#" + this.tag).width();
        } else {
            this.available_width = $("#" + this.tag).width() - $("#list_explorer").width();
        }

        if (this.availableSizeIsBiggerThanMinSize()) {
            if (this.available_width >= this.available_height) {
                this.current_vis_size = this.available_height;
            } else {
                this.current_vis_size = this.available_width;
            }
        } else {
            this.current_vis_size = this.getMinSize();
        }

        if (this.current_vis_size > this.max_height) {
            this.current_vis_size = this.max_height;
        }
    },


    // Calculate all scales for the current map
    initScales: function() {
        // Init all scales
        this.chart_x = d3.scale.linear();
        this.chart_y = d3.scale.linear();

        this.chart_x_circle = d3.scale.linear();
        this.chart_y_circle = d3.scale.linear();

        this.x = d3.scale.linear();
        this.y = d3.scale.linear();

        this.paper_x = d3.scale.linear();
        this.paper_y = d3.scale.linear();

        this.circle_size = d3.scale.sqrt();
        this.diameter_size = d3.scale.sqrt();
    },

    setScaleRanges: function() {
        // Calculate correct scaling factors and paper/circle dimensions
        this.correction_factor = this.current_vis_size / this.reference_size;

        this.circle_min = (this.min_area_size * this.correction_factor) * this.bubble_min_scale;
        this.circle_max = (this.max_area_size * this.correction_factor) * this.bubble_max_scale;
        this.circle_size.range([this.circle_min, this.circle_max]);

        this.paper_min = (this.min_diameter_size * this.correction_factor) * this.paper_min_scale;
        this.paper_max = (this.max_diameter_size * this.correction_factor) * this.paper_max_scale;
        this.diameter_size.range([this.paper_min, this.paper_max]);

        // Set ranges on scales
        this.padding_articles = 5; //this.paper_max;
        this.chart_x.range([this.padding_articles, this.current_vis_size - this.padding_articles]);
        this.chart_y.range([this.padding_articles, this.current_vis_size - this.padding_articles]);

        this.circle_padding = this.circle_max / 2 + 45;
        this.chart_x_circle.range([this.circle_padding, this.current_vis_size - this.circle_padding]);
        this.chart_y_circle.range([this.circle_padding, this.current_vis_size - this.circle_padding]);

        var zoomed_article_padding = 60;
        this.x.range([zoomed_article_padding, this.current_vis_size - zoomed_article_padding]);
        this.y.range([zoomed_article_padding, this.current_vis_size - zoomed_article_padding]);

        var zoomed_article_padding_paper = 35;
        this.paper_x.range([zoomed_article_padding_paper, this.current_vis_size - zoomed_article_padding_paper]);
        this.paper_y.range([zoomed_article_padding_paper, this.current_vis_size - zoomed_article_padding_paper]);
    },

    // Size helper functions
    getMinSize: function() {
        if (this.min_height >= this.min_width) {
            return this.min_width;
        } else {
            return this.min_height;
        }
    },

    availableSizeIsBiggerThanMinSize: function() {
        if (this.available_width > this.min_width && this.available_height > this.min_height) {
            return true;
        } else {
            return false;
        }
    },

    // auto if enough space is available, else hidden
    setOverflowToHiddenOrAuto: function(selector) {
        var overflow = "hidden";

        if (this.current_vis_size > this.available_height ||
            this.current_vis_size + this.list_width > this.available_width) {
            overflow = "auto";
        }

        d3.select(selector).style("overflow", overflow);
    },

    // Draw basic SVG canvas
    // NOTE attribute width addition by number of elements
    drawSvg: function(update) {

        update = typeof update !== 'undefined' ? update : false;

        this.svg = d3.select("#chart-svg");

        if (this.is("timeline")) {
            let s = this.current_vis_size * Object.keys(this.files).length;
            this.svg.attr("width", s)
                .attr("height", this.current_vis_size);
            if (update === false) {
                this.svg.attr("viewBox", "0 0 " + s + " " + this.current_vis_size);
            }
        } else {
            this.svg.attr("height", this.current_vis_size + "px")
                .attr("width", this.current_vis_size + "px");
            //.attr("preserveAspectRatio", "xMidYMid meet");
            if (update === false) {
                //this.svg.attr("viewBox", "0 0 " + this.current_vis_size + " " + this.current_vis_size);
            }
        }
    },

    drawChartCanvas: function() {

        this.chart = this.svg.append("g").attr("id", "chart_canvas");
        // Rectangle to contain nodes in force layout
        this.chart.append("rect");
        // var rect_width = this.current_vis_size;// + this.max_list_size;
        this.updateChartCanvas();

        //chart.attr( "height", this.current_vis_size + "px" )
        //chart.attr( "width",  this.current_vis_size + "px" );
    },

    updateChartCanvas: function() {
        d3.select("rect")
            .attr("height", this.current_vis_size + "px")
            .attr("width", this.current_vis_size + "px");
    },

    calcTitleFontSize: function() {
        if (this.current_vis_size <= 600) {
            return "12px";
        } else if (this.current_vis_size <= 1000) {
            return "14px";
        } else {
            return "16px";
        }
    },

    initEventListeners: function() {
        d3.select(window).on("resize", () => {
            if (this.is("timeline")) {
                return;
            }

            let resized_scale_x = d3.scale.linear();
            let resized_scale_y = d3.scale.linear();

            resized_scale_x.domain([0, this.current_vis_size]);
            resized_scale_y.domain([0, this.current_vis_size]);

            this.calcChartSize();
            this.setScaleRanges();
            this.drawSvg();
            this.updateChartCanvas();
            list.fit_list_height();

            resized_scale_x.range([0, this.current_vis_size]);
            resized_scale_y.range([0, this.current_vis_size]);

            d3.selectAll("g.bubble_frame")
                .attr("transform", (d) => {
                    d.x_zoomed = resized_scale_x(d.x_zoomed);
                    d.y_zoomed = resized_scale_y(d.y_zoomed);
                    d.x = resized_scale_x(d.x);
                    d.y = resized_scale_y(d.y);
                    if (this.is_zoomed === true) {
                        return "translate(" + d.x_zoomed + "," + d.y_zoomed + ")";
                    } else {
                        return "translate(" + d.x + "," + d.y + ")";
                    }
                });

            d3.selectAll("circle")
                .attr("r", (d) => {
                    d.r_zoomed = this.circle_size(d.readers) * this.circle_zoom;
                    d.r = this.circle_size(d.readers);
                    if (this.is_zoomed === true) {
                        return d.r_zoomed;
                    } else {
                        return d.r;
                    }
                });

            var area_title_objects = d3.selectAll("#area_title_object");

            area_title_objects.each((d) => {
                d.height_html = Math.sqrt(Math.pow(d.r, 2) * 2);
                d.width_html = Math.sqrt(Math.pow(d.r, 2) * 2);
                d.x_html = 0 - d.width_html / 2;
                d.y_html = 0 - d.height_html / 2;
            });

            area_title_objects
                .attr("x", (d) => {
                    return d.x_html; })
                .attr("y", (d) => {
                    return d.y_html; })
                .attr("width", (d) => {
                    return d.width_html; })
                .attr("height", (d) => {
                    return d.height_html; });

            area_title_objects.each(function() {
                d3.select(this).select("#area_title")
                    .style("width", (d) => {
                        return d.width_html + "px";
                    })
                    .style("height", (d) => {
                        return d.height_html + "px";
                    });
            });

            $("#area_title>h2").css("font-size", this.calcTitleFontSize());
            $("#area_title>h2").hyphenate('en');
            $("#area_title_object>body").dotdotdot({ wrap: "letter" });

            d3.selectAll("g.paper")
                .attr("transform", (d) => {
                    d.x_zoomed = resized_scale_x(d.x_zoomed);
                    d.y_zoomed = resized_scale_y(d.y_zoomed);
                    d.x = resized_scale_x(d.x);
                    d.y = resized_scale_y(d.y);
                    if (this.is_zoomed === true) {
                        return "translate(" + d.x_zoomed + "," + d.y_zoomed + ")";
                    } else {
                        return "translate(" + d.x + "," + d.y + ")";
                    }
                });

            var paper_holders = d3.selectAll("div.paper_holder");

            paper_holders.each((d) => {
                d.diameter = this.diameter_size(d.internal_readers);
                d.width = this.paper_width_factor * Math.sqrt(Math.pow(d.diameter, 2) / 2.6);
                d.height = this.paper_height_factor * Math.sqrt(Math.pow(d.diameter, 2) / 2.6);
                d.top_factor = (1 - this.dogear_width);

                d.width_zoomed = d.width * this.circle_zoom;
                d.height_zoomed = d.height * this.circle_zoom;

                d.resize_width = (this.is_zoomed) ? (d.width_zoomed) : (d.width);
                d.resize_height = (this.is_zoomed) ? (d.height_zoomed) : (d.height);
            });

            d3.selectAll("#region")
                .attr("d", (d) => {
                    return papers.createPaperPath(0, 0, d.resize_width, d.resize_height);
                });

            d3.selectAll("path.dogear")
                .attr("d", (d) => {
                    return papers.createDogearPath(d.resize_width * d.top_factor, 0, d.resize_width, d.resize_height);
                });

            //webkit bug
            d3.selectAll("#article_metadata")
                .attr("width", (d) => {
                    return d.resize_width; })
                .attr("height", (d) => {
                    return d.resize_height; });

            d3.selectAll("div.metadata")
                .style("width", (d) => {
                    return d.resize_width * d.top_factor + "px";
                })
                .style("height", (d) => {
                    if (!this.is_zoomed) {
                        return (this.content_based) ? (d.resize_height) : (d.resize_height * 0.8 + "px");
                    } else {
                        return (this.content_based) ? (d.resize_height + "px") : (d.resize_height - 20 + "px");
                    }
                });

            d3.selectAll("div.readers")
                .style("height", (d) => {
                    if (this.is_zoomed === false) {
                        return d.resize_height * 0.2 + "px";
                    } else {
                        return "15px";
                    }
                })
                .style("width", function(d) {
                    return d.resize_width + "px";
                });
        });

        // Info Modal Event Listener
        $('#info_modal').on('show.bs.modal', function() {
            $(this).find('.modal-title ').text(intro.title);
            $(this).find('.modal-body').html(intro.body);
        });
    },


    // Mouse interaction listeners
    initMouseListeners: function() {
        this.initMouseMoveListeners();
        this.initMouseClickListeners();
        this.initClickListenersForNav();
    },

    initMouseMoveListeners: function() {
        $("rect").on("mouseover", () => {
            if (!this.is_zoomed) {
                // this.current_bubble.onmouseout("notzoomedmouseout");
                this.current_bubble.onmouseout("notzoomedmouseout");
                this.current_circle = null;
            }
            this.current_bubble.mouseout("outofbigbubble");
            this.initClickListenersForNav();
        });
    },

    initMouseClickListeners: function() {
        $("#chart-svg").on("click", () => {
            this.current_bubble.zoomout();
        });

        $("#" + this.tag).bind('click', (event) => {
            if (event.target.className === "container-headstart" || event.target.className === "vis-col" || event.target.id === "headstart-chart") {
                this.current_bubble.zoomout();
            }
        });
    },

    initClickListenersForNav: function() {
        $("#timelineview").on("click", () => {
            if ($("#timelineview a").html() === "TimeLineView") {
                mediator.publish("to_timeline");
            }
        });
    },


    // Draws the header for this
    drawTitle: function() {
        let self = this;
        let chart_title = "";

        if (this.subdiscipline_title === "") {
            if (this.language === "eng") {
                chart_title = 'Overview of <span id="num_articles"></span> articles';
            } else {
                chart_title = 'Überblick über <span id="num_articles"></span> Artikel';
            }
        } else {
            chart_title = this.subdiscipline_title;
        }

        $("#subdiscipline_title h4").html(chart_title);
        $("#num_articles").html($(".paper").length);

        if (this.show_infolink) {
            let infolink = ' (<a data-toggle="modal" data-type="text" href="#info_modal" id="infolink"></a>)';
            $("#subdiscipline_title h4").append(infolink);
            $("#infolink").text(this.localization[this.language].intro_label);
        }

        if (this.show_timeline) {
            let link = ' <span id="timelineview"><a href="#">TimeLineView</a></span>';
            $("#subdiscipline_title>h4").append(link);
        }

        if (!this.is("timeline")) {
            let dropdown = '<select id="datasets"></select>';

            $("#subdiscipline_title>h4").append(" Select dataset: ");
            $("#subdiscipline_title>h4").append(dropdown);

            $.each(this.files, (index, entry) => {
                let current_item = '<option value="' + entry.file + '">' + entry.title + '</option>';
                $("#datasets").append(current_item);
            });

            //$("#datasets " + headstart.current_file_number + ":selected").text();
            $("#datasets").val(this.files[this.current_file_number].file);

            $("#datasets").change(function() {
                let selected_file_number = this.selectedIndex + 1;
                if (selected_file_number !== self.current_file_number) {
                    self.tofile(selected_file_number);
                }
            });
        }
    },

    initForceAreas: function() {
        let padded = this.current_vis_size - this.padding;
        this.force_areas = d3.layout.force().links([]).size([padded, padded]);
    },

    initForcePapers: function() {
        let padded = this.current_vis_size - this.padding;
        this.force_papers = d3.layout.force().nodes([]).links([]).size([padded, padded]);
        if (typeof checkPapers !== 'undefined') {
            window.clearInterval(checkPapers);
        }
    },

    // calls itself over and over until the forced layout of the papers
    // is established
    checkForcePapers: function() {
        var bubble = this.current_bubble;

        if (this.is("normal") || this.is("switchfiles")) {
            var checkPapers = window.setInterval(() => {
                if (this.is("normal") || this.is("switchfiles")) {
                    if ((!papers.is("ready") && !papers.is("none")) || (bubble.is("startup") || bubble.is("none") || (bubble.is("start")))) {
                        if (this.force_papers.alpha() <= 0 && this.force_areas.alpha() <= 0) {
                            papers.forced();
                            if (this.show_list) {
                                list.show();
                            }
                            window.clearInterval(checkPapers);
                        }
                    }
                }
            }, 10);
        }
    },

    // Grid drawing methods
    // draw x and y lines in svg canvas for timelineview
    drawGrid: function() {
        this.drawXGrid();
        this.drawYGrid();
    },

    removeGrid: function() {
        $("line").remove();
    },

    drawYGrid: function() {
        var to = (this.files.length * this.current_vis_size);
        for (var i = 0; i <= to; i += this.current_vis_size) {
            this.svg.append("line")
                .attr("x1", i)
                .attr("x2", i)
                .attr("y1", "0")
                .attr("y2", "900");
        }
    },

    drawXGrid: function() {
        for (var i = 0; i <= 900; i += 50) {
            this.svg.append("line")
                .attr("x1", "0")
                .attr("x2", this.files.length * this.current_vis_size)
                .attr("y1", i)
                .attr("y2", i);
        }
    },

    drawGridTitles: function(update) {

        update = typeof update !== 'undefined' ? update : false;

        if (update === true) {
            $("#tl-titles").width(this.current_vis_size * this.files.length);
            $(".tl-title").css("width", this.current_vis_size);
        } else {
            for (var i = 0; i < this.files.length; i++) {
                $("#tl-titles").append(
                    '<div class="tl-title"><h3>' + this.files[i].title + '</h3></div>');
            }
            $("#tl-titles").width(this.current_vis_size * this.files.length);
            $(".tl-title").css("width", this.current_vis_size);
        }
    },

    // Only used if 'adaptive' is set
    createRestUrl: function() {
        let url = this.server_url + "services/getBookmarks.php?user=" + this.user_id;

        //sometimes the conference id array is not recognized
        let conference_id = eval(this.conference_id);

        if ($.isArray(conference_id)) {
            conference_id.forEach((val) => {
                url += "&conference[]=" + val;
            });
        } else {
            url += "&conference=" + this.conference_id;
        }

        url += "&max_recommendations=" + this.max_recommendations;

        url += "&jsoncallback=?";

        return url;
    },


    initCanvas: function() {
        if (this.is("timeline")) {
            if (typeof checkPapers !== 'undefined') {
                window.clearInterval(checkPapers);
            }

            this.force_areas.stop();
            this.force_papers.stop();

            // clear the canvas
            $("#chart_canvas").empty();

            // clear the list list
            $("#list_explorer").empty();

            this.current_bubble.current = "x";
            papers.current = "none";
            list.current = "none";

            // change heading to give an option to get back to normal view
            this.viz.empty();

            let timeline = timelineTemplate();
            this.viz.append(timeline);
        } else {
            this.calcChartSize();
            this.initScales();
            this.checkBrowserVersions();
            this.setOverflowToHiddenOrAuto("#main");

        }
    },


    getFiles: function() {
        switch (this.mode) {
            case 'local_files':
                this.prepareUI();
                break;

            case 'server_files':
                $.getJSON(this.server_url + "services/staticFiles.php", (data) => {
                    this.files = [];
                    for (let i = 0; i < data.length; i++) {
                        this.files.push({
                            "title": data[i].title,
                            "file": this.server_url + data[i].file
                        });
                    }
                    this.prepareUI();
                });
                break;

            case 'search_repos':
                break;
        }
    },


    drawDropdown: function() {
    		let self = this;
        let dropdown = '<select id="datasets"></select>';

        $("#subdiscipline_title>h4").append(" Select dataset: ");
        $("#subdiscipline_title>h4").append(dropdown);

        $.each(this.files, (index, entry) => {
            let current_item = '<option value="' + entry.file + '">' + entry.title + '</option>';
            $("#datasets").append(current_item);
        });

        //$("#datasets " + headstart.current_file_number + ":selected").text();
        $("#datasets").val(this.files[this.current_file_number].file);

        $("#datasets").change(function() {
            let selected_file_number = this.selectedIndex + 1;
            if (selected_file_number !== self.current_file_number) {
                self.tofile(selected_file_number);
            }
        });
    },

    getCurrentMap: function() {
        if (this.is("timeline")) {
            this.bubbles = [];

            $.each(this.files, (index, file) => {
                switch (this.input_format) {
                    case "csv":
                        d3.csv(file.file, (data) => {
                            this.initBubbleFSM(data, index);
                            this.bubbles.push(this.current_bubble);
                            this.bubbles[index].start(data);
                        });
                        break;

                    case "json":
                        d3.json(file.file, (data) => {
                            this.initBubbleFSM(data, index);
                            this.bubbles.push(this.current_bubble);
                            this.bubbles[index].start(data);
                        });
                        break;
                }
            });
        } else {
            switch (this.input_format) {
                case "csv":
                    d3.csv(this.files[this.current_file_number].file, (data) => {
                        this.initBubbleFSM(data, this.current_file_number);
                        this.drawMap();
                    });
                    break;

                case "json":
                    d3.json(this.files[this.current_file_number].file, (data) => {
                        this.initBubbleFSM(data, this.current_file_number);
                        this.drawMap();
                    });
                    break;
            }
        }
    },

    initBubbleFSM: function(data, id) {
        this.current_bubble = new BubblesFSM();
        this.current_bubble.title = this.files[this.current_file_number].title;
        this.current_bubble.file = this.files[this.current_file_number].file;
        this.current_bubble.id = id;
        this.current_bubble.data = data;
    },

    drawMap: function() {
        this.drawTitle();

        this.calcChartSize();
        this.setScaleRanges();

        this.drawSvg();
        this.drawChartCanvas();
        this.startVisualization(this, this.current_bubble, this.current_bubble.data, null, true);
        this.drawTitle();
    },

    prepareUI: function() {
        if (this.is('timeline')) {
            this.drawTitle();
            this.drawGridTitles();

            this.drawNormalViewLink();
            this.initScales();

            this.calcChartSize();
            this.setScaleRanges();
            this.drawSvg();
            this.drawChartCanvas();

            this.drawGridTitles(true);
            $("#headstart-chart").css("overflow-x", "scroll");
            $("#main").css("overflow", "auto");
            this.drawGrid();
            this.initMouseListeners();
        } else {
            this.drawTitle();        
        }

        // get the first map to be shown
        this.getCurrentMap(); // Ajax - calls drawMap() on success
    },


    // Start of Headstart in normal mode (vs timeline)
    onstart: function() {
        // prepares scales etc for current window
        this.initCanvas();

        // gets the file/files that are going to be shown (no map data yet. only current this.files array)
        this.getFiles(); // Ajax - calls prepareUI() on success
    },

    ontofile: function(event, from, to, file) {
        // still the same inits
        // initFileChange();
        this.force_areas.stop();
        this.force_papers.stop();

        this.current_file_number = file;

        // clear the canvas & list
        $("#chart_canvas").remove();
        $("#list_explorer").empty();

        // popup.current = "hidden";
        papers.current = "none";
        list.current = "none";

        // this.initScales();
        this.setOverflowToHiddenOrAuto("#main");

        this.getCurrentMap();
    },

    ontotimeline: function() {
        this.onstart();
    },


    startVisualization: function(hs, bubbles, csv, adaptive_data) {
        bubbles.start(csv, adaptive_data);

        hs.initEventListeners();
        hs.initMouseListeners();
        hs.initForcePapers();
        hs.initForceAreas();

        papers.start(bubbles);
        // moving this to bubbles.start results in papers being displayed over the
        // bubbles, unfortunately
        bubbles.draw();

        bubbles.initMouseListeners();

        list.start(bubbles);

        hs.checkForcePapers();

        if (hs.show_intro) {
            $("#infolink").click();
        }

        $("#area_title>h2").hyphenate('en');
        $("#area_title_object>body").dotdotdot({ wrap: "letter" });
    },

    // hard reload of the page
    drawNormalViewLink: function() {
        // remove event handler
        $("#timelineview").off("click");

        // refreshes page
        var link = ' <a href="" id="normal_link">Normal View</a>';
        $("#timelineview").html(link);
    }
}; // end HeadstartFSM prototype definition

// State definitions for headstart object
// see "onstart" function for entry point e.g. the first code that
// gets excuted here.
StateMachine.create({

    target: HeadstartFSM.prototype,

    events: [
        { name: "start", from: "none", to: "normal" },
        { name: "totimeline", from: ["normal", "switchfiles"], to: "timeline" },
        { name: "tofile", from: ["normal", "switchfiles", "timeline"], to: "switchfiles" }
    ]

});
