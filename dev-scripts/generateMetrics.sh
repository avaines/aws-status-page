#!/bin/bash
# filepath: ./record_metrics.sh
# Check for exactly 5 parameters

if [ "$#" -ne 5 ]; then
    echo "Usage: $0 ServiceA ServiceB ServiceC ServiceD ServiceE"
    exit 1
fi

# Function to convert accepted values to numeric
convert_value() {
    local input=$(echo "$1" | tr '[:upper:]' '[:lower:]')
    if [ "$input" = "true" ] || [ "$input" = "1" ]; then
        echo 1
    elif [ "$input" = "false" ] || [ "$input" = "0" ]; then
        echo 0
    else
        echo "Invalid value: $1" >&2
        exit 1
    fi
}

services=("ServiceA" "ServiceB" "ServiceC" "ServiceD" "ServiceE")
values=("$1" "$2" "$3" "$4" "$5")

# Set your custom CloudWatch namespace
namespace="StatusPageCustomMetrics"

# Iterate over each service and record the metric with AWS CLI
for i in "${!services[@]}"; do
    metric_name="${services[$i]}"
    metric_value=$(convert_value "${values[$i]}")

    echo "Recording metric for $metric_name with value $metric_value..."

    aws cloudwatch put-metric-data \
        --namespace "$namespace" \
        --metric-data MetricName="$metric_name",Value="$metric_value",Unit=None
done

echo "Metrics recorded successfully."