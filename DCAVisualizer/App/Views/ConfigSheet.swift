import SwiftUI
import DCAKit

/// Configuration sheet for DCA simulation settings
struct ConfigSheet: View {
    @Bindable var configStore: ConfigStore
    let onDismiss: () -> Void

    @State private var tickerInput: String = ""

    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            Form {
                // Ticker Section
                Section("Stock") {
                    HStack {
                        TextField("Ticker Symbol", text: $tickerInput)
                            .textInputAutocapitalization(.characters)
                            .autocorrectionDisabled()
                            .onChange(of: tickerInput) { _, newValue in
                                tickerInput = newValue.uppercased()
                            }
                            .accessibilityIdentifier("tickerField")
                    }
                }

                // Investment Section
                Section("Investment") {
                    HStack {
                        Text("Amount")
                        Spacer()
                        TextField("Amount", value: $configStore.amount, format: .currency(code: "USD"))
                            .keyboardType(.decimalPad)
                            .multilineTextAlignment(.trailing)
                            .frame(width: 120)
                            .accessibilityIdentifier("amountField")
                    }

                    Picker("Frequency", selection: $configStore.frequency) {
                        ForEach(InvestmentFrequency.allCases, id: \.self) { freq in
                            Text(freq.displayName).tag(freq)
                        }
                    }
                    .accessibilityIdentifier("frequencyPicker")
                }

                // Date Range Section
                Section("Time Period") {
                    DatePicker(
                        "Start Date",
                        selection: $configStore.startDate,
                        in: ...configStore.endDate,
                        displayedComponents: .date
                    )
                    .accessibilityIdentifier("startDatePicker")

                    DatePicker(
                        "End Date",
                        selection: $configStore.endDate,
                        in: configStore.startDate...,
                        displayedComponents: .date
                    )
                    .accessibilityIdentifier("endDatePicker")
                }

                // Options Section
                Section("Options") {
                    Toggle("Reinvest Dividends (DRIP)", isOn: $configStore.isDRIP)
                        .accessibilityIdentifier("dripToggle")

                    Toggle("Show Lump Sum Comparison", isOn: $configStore.showLumpSum)
                        .accessibilityIdentifier("lumpSumToggle")
                }

                // Info Section
                Section {
                    VStack(alignment: .leading, spacing: 8) {
                        Label("Dollar Cost Averaging", systemImage: "dollarsign.circle")
                            .font(.headline)
                        Text("DCA spreads your investment over time, reducing the impact of market volatility.")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }
            }
            .navigationTitle("Settings")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") {
                        dismiss()
                    }
                    .accessibilityIdentifier("cancelButton")
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Apply") {
                        applyChanges()
                    }
                    .disabled(tickerInput.isEmpty)
                    .accessibilityIdentifier("applyButton")
                }
            }
            .onAppear {
                tickerInput = configStore.ticker
            }
        }
        .presentationDetents([.large])
    }

    private func applyChanges() {
        configStore.ticker = tickerInput
        configStore.validateDateRange()
        dismiss()
        onDismiss()
    }
}

#Preview {
    ConfigSheet(configStore: ConfigStore()) {}
}
