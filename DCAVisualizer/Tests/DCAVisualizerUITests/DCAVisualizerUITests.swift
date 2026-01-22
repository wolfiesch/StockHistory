import XCTest

final class DCAVisualizerUITests: XCTestCase {
    override func setUpWithError() throws {
        continueAfterFailure = false
    }

    func testRunSimulationFromSettings() throws {
        let app = launchApp()
        runSimulation(using: app)

        waitForLoadedState(in: app)

        captureScreenshot("Loaded-State")

        XCTAssertTrue(app.staticTexts["Total Value"].waitForExistence(timeout: 2))
        XCTAssertTrue(playbackButton(in: app).waitForExistence(timeout: 2))
    }

    func testPlaybackControls() throws {
        let app = launchApp()
        runSimulation(using: app)
        waitForLoadedState(in: app)

        let playButton = playbackButton(in: app)
        XCTAssertTrue(playButton.waitForExistence(timeout: 2))
        playButton.tap()

        captureScreenshot("Playback")

        let resetButton = app.buttons["playbackResetButton"]
        if resetButton.waitForExistence(timeout: 2) {
            resetButton.tap()
        }
    }

    func testCacheIndicatorAppearsOnSecondRun() throws {
        let app = launchApp()
        runSimulation(using: app)
        waitForLoadedState(in: app)

        let settingsButton = app.buttons["settingsButton"]
        XCTAssertTrue(settingsButton.waitForExistence(timeout: 2))
        settingsButton.tap()

        let applyButton = app.buttons["applyButton"]
        XCTAssertTrue(applyButton.waitForExistence(timeout: 2))
        applyButton.tap()

        waitForLoadedState(in: app)

        let cacheIndicator = app.staticTexts.matching(NSPredicate(format: "label BEGINSWITH 'Data from'"))
        XCTAssertTrue(cacheIndicator.firstMatch.waitForExistence(timeout: 2))

        captureScreenshot("Cache-Indicator")
    }

    func testInvalidTickerShowsError() throws {
        let app = launchApp()
        openSettings(in: app)

        let tickerField = app.textFields["tickerField"]
        XCTAssertTrue(tickerField.waitForExistence(timeout: 2))
        replaceText(in: tickerField, with: "ZZZZ")

        applySettings(in: app)
        waitForErrorState(in: app)

        XCTAssertTrue(app.otherElements["errorView"].waitForExistence(timeout: 2))
        captureScreenshot("Error-State")
    }
}

private extension DCAVisualizerUITests {
    func launchApp() -> XCUIApplication {
        let app = XCUIApplication()
        app.launchEnvironment["USE_STUB_NETWORK"] = "1"
        app.launchEnvironment["RESET_CACHE"] = "1"
        app.launch()
        return app
    }

    func runSimulation(using app: XCUIApplication) {
        openSettings(in: app)
        applySettings(in: app)
    }

    func openSettings(in app: XCUIApplication) {
        let getStartedButton = app.buttons["getStartedButton"]
        if getStartedButton.waitForExistence(timeout: 2) {
            getStartedButton.tap()
            return
        }

        let settingsButton = app.buttons["settingsButton"]
        if settingsButton.waitForExistence(timeout: 2) {
            settingsButton.tap()
        }
    }

    func applySettings(in app: XCUIApplication) {
        let applyButton = app.buttons["applyButton"]
        XCTAssertTrue(applyButton.waitForExistence(timeout: 2))
        applyButton.tap()
    }

    func waitForLoadedState(in app: XCUIApplication, timeout: TimeInterval = 5) {
        let statusLabel = app.staticTexts["testStatusLabel"]
        XCTAssertTrue(statusLabel.waitForExistence(timeout: 2))

        let predicate = NSPredicate(format: "label CONTAINS 'state=loaded'")
        expectation(for: predicate, evaluatedWith: statusLabel, handler: nil)
        waitForExpectations(timeout: timeout)
    }

    func waitForErrorState(in app: XCUIApplication, timeout: TimeInterval = 5) {
        let statusLabel = app.staticTexts["testStatusLabel"]
        XCTAssertTrue(statusLabel.waitForExistence(timeout: 2))

        let predicate = NSPredicate(format: "label CONTAINS 'state=error'")
        expectation(for: predicate, evaluatedWith: statusLabel, handler: nil)
        waitForExpectations(timeout: timeout)
    }

    func replaceText(in element: XCUIElement, with text: String) {
        element.tap()
        if let currentValue = element.value as? String {
            let deleteString = String(repeating: "\u{8}", count: currentValue.count)
            element.typeText(deleteString)
        }
        element.typeText(text)
    }

    func captureScreenshot(_ name: String) {
        let screenshot = XCUIScreen.main.screenshot()
        let attachment = XCTAttachment(screenshot: screenshot)
        attachment.name = name
        attachment.lifetime = .keepAlways
        add(attachment)
    }

    func playbackButton(in app: XCUIApplication) -> XCUIElement {
        let predicate = NSPredicate(format: "label == 'Play' OR label == 'Pause'")
        return app.buttons.matching(predicate).firstMatch
    }
}
