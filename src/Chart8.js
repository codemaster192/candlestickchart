import React, { Component } from "react";
import * as am5 from "@amcharts/amcharts5";
import * as am5xy from "@amcharts/amcharts5/xy";
import * as am5stock from "@amcharts/amcharts5/stock";
import am5themes_Animated from "@amcharts/amcharts5/themes/Animated";
import am5themes_Dark from "@amcharts/amcharts5/themes/Dark";
import * as XLSX from "xlsx";

class Chart8 extends Component {

    constructor(props) {
        super(props);
        this.intervalId = null;
    }

    componentDidMount() {
        var root = am5.Root.new("chartdiv");

        // Set themes
        root.setThemes([am5themes_Animated.new(root), am5themes_Dark.new(root)]);

        // Create a stock chart
        var stockChart = root.container.children.push(am5stock.StockChart.new(root, {}));

        // Set global number format
        root.numberFormatter.set("numberFormat", "#,###.00");

        // Main (value) panel
        var mainPanel = stockChart.panels.push(
            am5stock.StockPanel.new(root, {
                wheelX: "panX",
                wheelY: "zoomX",
                panX: true,
                panY: true,
                height: am5.percent(100),
                pinchZoomX: true,
            })
        );

        // Create axes
        var valueAxis = mainPanel.yAxes.push(
            am5xy.ValueAxis.new(root, {
                renderer: am5xy.AxisRendererY.new(root, {
                    pan: "zoom",
                }),
                tooltip: am5.Tooltip.new(root, {}),
                numberFormat: "#,###.00",
                extraTooltipPrecision: 2,
            })
        );

        var dateAxis = mainPanel.xAxes.push(
            am5xy.GaplessDateAxis.new(root, {
                baseInterval: {
                    timeUnit: "minute",
                    count: 3,
                },
                groupData: false,
                renderer: am5xy.AxisRendererX.new(root, {
                    minorGridEnabled: true,
                    minGridDistance: 70,
                }),
                tooltip: am5.Tooltip.new(root, {}),
            })
        );

        // Add series
        var valueSeries = mainPanel.series.push(
            am5xy.CandlestickSeries.new(root, {
                name: "MSFT",
                clustered: false,
                valueXField: "timestamp",
                valueYField: "close",
                highValueYField: "high",
                lowValueYField: "low",
                openValueYField: "open",
                calculateAggregates: true,
                xAxis: dateAxis,
                yAxis: valueAxis,
                legendValueText: "{valueY}",
            })
        );

        // Set main value series
        stockChart.set("stockSeries", valueSeries);

        // Add a stock legend
        var valueLegend = mainPanel.plotContainer.children.push(
            am5stock.StockLegend.new(root, {
                stockChart: stockChart,
            })
        );
        valueLegend.data.setAll([valueSeries]);

        // Volume axis configuration
        var volumeAxisRenderer = am5xy.AxisRendererY.new(root, {
            inside: true,
        });

        volumeAxisRenderer.labels.template.set("forceHidden", false);
        volumeAxisRenderer.grid.template.set("forceHidden", true);

        var volumeValueAxis = mainPanel.yAxes.push(
            am5xy.ValueAxis.new(root, {
                numberFormat: "#.#a",
                height: am5.percent(20),
                y: am5.percent(100),
                centerY: am5.percent(100),
                renderer: volumeAxisRenderer,
            })
        );

        // Add volume series
        var volumeSeries = mainPanel.series.push(
            am5xy.ColumnSeries.new(root, {
                name: "Volume",
                clustered: false,
                valueXField: "timestamp",
                valueYField: "volume",
                xAxis: dateAxis,
                yAxis: volumeValueAxis,
                legendValueText: "[bold]{valueY.formatNumber('#,###.0a')}[/]",
            })
        );

        volumeSeries.columns.template.setAll({
            strokeOpacity: 0,
            fillOpacity: 0.5,
        });

        volumeSeries.columns.template.adapters.add("fill", function (fill, target) {
            var dataItem = target.dataItem;
            if (dataItem) {
                return stockChart.getVolumeColor(dataItem);
            }
            return fill;
        });

        stockChart.set("volumeSeries", volumeSeries);
        valueLegend.data.setAll([valueSeries, volumeSeries]);

        // Add cursor
        mainPanel.set(
            "cursor",
            am5xy.XYCursor.new(root, {
                yAxis: valueAxis,
                xAxis: dateAxis,
                snapToSeries: [valueSeries],
                snapToSeriesBy: "y!",
            })
        );

        // Load data from files
        const loadFile = async (series) => {
            try {
                const response = await fetch('/price_action.xlsx');
                const nextResponse = await fetch('/v14.5-111.xlsx');
                const arrayBuffer = await response.arrayBuffer();
                const nextBuffer = await nextResponse.arrayBuffer();
                const workbook = XLSX.read(arrayBuffer, { type: 'array' });
                const nextBook = XLSX.read(nextBuffer, { type: 'array' });
                const firstSheetName = workbook.SheetNames[0];
                const nextSheetName = nextBook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];
                const nextSheet = nextBook.Sheets[nextSheetName];
                const csvData = XLSX.utils.sheet_to_csv(worksheet, { header: 1 });
                const nextData = XLSX.utils.sheet_to_csv(nextSheet, { header: 1 });

                var data = am5.CSVParser.parse(csvData, {
                    delimiter: ",",
                    skipEmpty: true,
                    useColumnNames: true
                });

                var nextPrice = am5.CSVParser.parse(nextData, {
                    delimiter: ",",
                    skipEmpty: true,
                    useColumnNames: true
                });

                var processor = am5.DataProcessor.new(root, {
                    dateFields: ["timestamp"],
                    dateFormat: "yyyy-MM-dd HH:mm:ss",
                    numericFields: [
                        "open",
                        "high",
                        "low",
                        "close",
                        "volume"
                    ]
                });
                processor.processMany(data);

                var processorNext = am5.DataProcessor.new(root, {
                    dateFields: ["timestamp"],
                    dateFormat: "yyyy-MM-dd HH:mm:ss",
                    numericFields: [
                        "Next Price"
                    ]
                });
                processorNext.processMany(nextPrice);

                am5.array.each(series, function (item) {
                    item.data.setAll(data);
                });

                const poc = calculatePOC(data);
                addPOCLine(poc);
                addNextPriceLine(nextPrice[0]["Next Price"]);

                setTimeout(() => {
                    createRibbonBand(); // Call to create the ribbon band
                }, 1000);

                console.log("123");

            } catch (error) {
                console.error('Error loading XLSX file:', error);
            }
        }
        loadFile([valueSeries, volumeSeries]);

        this.intervalId = setInterval(() => {
            loadFile([valueSeries, volumeSeries]);
        }, 5000);

        // Calculate Point of Control
        const calculatePOC = (data) => {
            const volumeByPrice = {};

            data.forEach(({ close, volume }) => {
                if (!volumeByPrice[close]) {
                    volumeByPrice[close] = 0;
                }
                volumeByPrice[close] += volume;
            });

            let poc = null;
            let maxVolume = 0;

            for (const [price, volume] of Object.entries(volumeByPrice)) {
                if (volume > maxVolume) {
                    maxVolume = volume;
                    poc = parseFloat(price);
                }
            }

            return poc;
        };

        // Add POC line to the chart
        const addPOCLine = (pocValue) => {
            var pocRange = valueAxis.makeDataItem({
                value: pocValue
            });

            valueAxis.createAxisRange(pocRange);

            pocRange.get("grid").setAll({
                strokeOpacity: 1,
                strokeDasharray: [3, 3],
                stroke: am5.color(0xff0000),
                strokeWidth: 4
            });

            pocRange.get("label").setAll({
                text: "POC: " + pocValue.toFixed(2),
                fill: am5.color(0xff0000),
                background: am5.Rectangle.new(root, {
                    fillOpacity: 1,
                    fill: am5.color(0xffffff),
                })
            });
        }

        // Add the Next Price line
        const addNextPriceLine = (nextPrice) => {
            var nextRange = valueAxis.makeDataItem({
                value: nextPrice
            });

            valueAxis.createAxisRange(nextRange);

            nextRange.get("grid").setAll({
                strokeOpacity: 1,
                strokeDasharray: [3, 3],
                stroke: am5.color(0x0000ff),
                strokeWidth: 4
            });

            nextRange.get("label").setAll({
                text: "Next Price: " + nextPrice.toFixed(2),
                fill: am5.color(0xff0000),
                background: am5.Rectangle.new(root, {
                    fillOpacity: 1,
                    fill: am5.color(0xffffff),
                })
            });
        }

        // Create the ribbon band
        const createRibbonBand = () => {
            const ma3Data = movingAverage3.series.dataItems;
            const ma4Data = movingAverage4.series.dataItems;

            let ribbonData = [];
            for (let i = 0; i < ma3Data.length && i < ma4Data.length; i++) {
                let ma3Value = ma3Data[i].get("valueY");
                let ma4Value = ma4Data[i].get("valueY");
                let timestamp = ma3Data[i].get("valueX");

                // Determine upper and lower bounds and color
                let low = Math.min(ma3Value, ma4Value);
                let high = Math.max(ma3Value, ma4Value);
                let color = ma3Value > ma4Value ? am5.color(0xff0000) : am5.color(0x00ff00);

                ribbonData.push({
                    timestamp,
                    low,
                    high,
                    color, // Store color for later use
                });
            }

            // Create a custom series for the ribbon band
            var ribbonSeries = mainPanel.series.push(
                am5xy.ColumnSeries.new(root, {
                    clustered: true,
                    xAxis: dateAxis,
                    yAxis: valueAxis,
                    valueXField: "timestamp",
                    openValueYField: "low",
                    valueYField: "high",
                })
            );

            ribbonSeries.data.setAll(ribbonData);

            // Set fill color based on the higher moving average
            ribbonSeries.columns.template.adapters.add("fill", function (fill, target) {
                let dataItem = target.dataItem;
                if (dataItem) {
                    return dataItem.dataContext.color; // Use the stored color
                }
                return fill;
            });

            ribbonSeries.columns.template.setAll({
                width: am5.percent(100),
                fillOpacity: 0.2,
                strokeOpacity: 0,
            });
        };


        var volumeProfile = stockChart.indicators.push(am5stock.VolumeProfile.new(root, {
            stockChart: stockChart,
            stockSeries: valueSeries,
            volumeSeries: volumeSeries,
            legend: valueLegend,
            count: 30,
            axisWidth: 20
        }));

        // Create moving averages
        var movingAverage1 = stockChart.indicators.push(am5stock.MovingAverageEnvelope.new(root, {
            stockSeries: valueSeries,
            period: 20,
            shift: 0.003,
            lowerColor: am5.color(0xfff000),
            upperColor: am5.color(0xfff000),
            seriesColor: am5.color(0xfff000)
        }));

        var movingAverage2 = stockChart.indicators.push(am5stock.MovingAverageEnvelope.new(root, {
            stockSeries: valueSeries,
            period: 50,
            shift: 0.003,
            lowerColor: am5.color(0xff8040),
            upperColor: am5.color(0xff8040),
            seriesColor: am5.color(0xff8040)
        }));

        var movingAverage3 = stockChart.indicators.push(am5stock.MovingAverageEnvelope.new(root, {
            stockSeries: valueSeries,
            period: 100,
            shift: 0.003,
            lowerColor: am5.color(0xff0000),
            upperColor: am5.color(0xff0000),
            seriesColor: am5.color(0xff0000)
        }));

        var movingAverage4 = stockChart.indicators.push(am5stock.MovingAverageEnvelope.new(root, {
            stockSeries: valueSeries,
            period: 200,
            shift: 0.003,
            lowerColor: am5.color(0x00ff00),
            upperColor: am5.color(0x00ff00),
            seriesColor: am5.color(0x00ff00)
        }));




        // You can remove previous settings related to the ribbonSeries during ColumnSeries implementation, like strokeOpacity.

        // Stock toolbar
        var toolbar = am5stock.StockToolbar.new(root, {
            container: document.getElementById("chartcontrols"),
            stockChart: stockChart,
            controls: [
                am5stock.DrawingControl.new(root, {
                    stockChart: stockChart
                }),
            ]
        });

        this.root = root;
    }

    componentWillUnmount() {
        if (this.root) {
            clearInterval(this.intervalId);
            this.root.dispose();
        }
    }

    render() {
        return (
            <div>
                <div id="chartcontrols" style={{ height: "5vh", padding: "10px", backgroundColor: "black" }}></div>
                <div id="chartdiv" style={{ width: "100%", height: "90vh", backgroundColor: "black" }}></div>
            </div>
        );
    }
}

export default Chart8;

