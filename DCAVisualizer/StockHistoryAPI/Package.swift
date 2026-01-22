// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "StockHistoryAPI",
    platforms: [.iOS(.v17), .macOS(.v14)],
    products: [
        .library(
            name: "StockHistoryAPI",
            targets: ["StockHistoryAPI"]
        ),
    ],
    dependencies: [
        .package(path: "../DCAKit"),
    ],
    targets: [
        .target(
            name: "StockHistoryAPI",
            dependencies: ["DCAKit"],
            path: "Sources/StockHistoryAPI"
        ),
        .testTarget(
            name: "StockHistoryAPITests",
            dependencies: ["StockHistoryAPI", "DCAKit"],
            path: "Tests/StockHistoryAPITests"
        ),
    ]
)
