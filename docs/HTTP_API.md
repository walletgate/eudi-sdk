# WalletGate HTTP API Reference

This guide shows how to integrate WalletGate EUDI verification from any programming language using direct HTTP calls.

## Authentication

All API requests require an API key in the Authorization header:

```http
Authorization: Bearer wg_test_your_api_key_here
```

## Base URL

**Test Environment:** `https://api.walletgate.app`
**Production:** `https://api.walletgate.app` (same URL, use live API keys)

## Core Endpoints

### 1. Start Verification Session

Creates a new verification session and returns a URL for the user's wallet.

**Endpoint:** `POST /v1/verify/sessions`

**Request Body:**
```json
{
  "checks": [
    {
      "type": "age_over",
      "value": 18
    },
    {
      "type": "residency_eu"
    }
  ],
  "redirectUrl": "https://yourapp.com/success",
  "webhookUrl": "https://yourapp.com/webhook",
  "metadata": {
    "userId": "user_123",
    "source": "checkout"
  },
  "enableAI": true
}
```

**Response:**
```json
{
  "id": "sess_abc123def456",
  "merchantId": "merchant_789",
  "status": "pending",
  "checks": [
    {
      "type": "age_over",
      "value": 18,
      "passed": null
    }
  ],
  "walletRequestUrl": "https://test-wallet.walletgate.app/verify/sess_abc123def456",
  "expiresAt": "2025-09-25T19:30:00Z",
  "createdAt": "2025-09-25T18:30:00Z",
  "updatedAt": "2025-09-25T18:30:00Z"
}
```

### 2. Get Verification Result

Retrieves the current status and result of a verification session.

**Endpoint:** `GET /v1/verify/sessions/{sessionId}`

**Response (Pending):**
```json
{
  "sessionId": "sess_abc123def456",
  "status": "pending",
  "message": "Waiting for user to complete verification"
}
```

**Response (Completed):**
```json
{
  "sessionId": "sess_abc123def456",
  "approved": true,
  "checks": [
    {
      "type": "age_over",
      "value": 18,
      "passed": true
    },
    {
      "type": "residency_eu",
      "passed": true
    }
  ],
  "auditRef": "audit_xyz789",
  "timestamp": "2025-09-25T18:35:00Z"
}
```

## Language Examples

### Ruby

```ruby
require 'net/http'
require 'json'
require 'openssl'
require 'base64'

class WalletGateError < StandardError
  attr_reader :code, :status_code, :details

  def initialize(message, code = nil, status_code = nil, details = nil)
    super(message)
    @code = code
    @status_code = status_code
    @details = details
  end
end

class WalletGate
  API_TIMEOUT = 30
  MAX_RETRIES = 3
  RETRY_DELAY = 1.0
  RETRY_BACKOFF = 2.0

  def initialize(api_key, base_url = 'https://api.walletgate.app', timeout: API_TIMEOUT)
    raise ArgumentError, 'API key cannot be empty' if api_key.nil? || api_key.strip.empty?

    @api_key = api_key.strip
    @base_url = base_url.gsub(/\/+$/, '') # Remove trailing slashes
    @timeout = timeout
  end

  def start_verification(checks:, redirect_url: nil, webhook_url: nil, metadata: {}, enable_ai: nil)
    validate_checks(checks)
    validate_url(redirect_url, 'redirect_url') if redirect_url
    validate_url(webhook_url, 'webhook_url') if webhook_url

    body = { checks: checks }
    body[:redirectUrl] = redirect_url if redirect_url
    body[:webhookUrl] = webhook_url if webhook_url
    body[:metadata] = metadata unless metadata.empty?
    body[:enableAI] = enable_ai unless enable_ai.nil?

    make_request(:post, '/v1/verify/sessions', body)
  end

  def get_result(session_id)
    raise ArgumentError, 'Session ID cannot be empty' if session_id.nil? || session_id.strip.empty?

    session_id = session_id.strip
    make_request(:get, "/v1/verify/sessions/#{session_id}")
  end

  def poll_for_result(session_id, max_wait_seconds: 300, poll_interval: 5)
    start_time = Time.now

    loop do
      begin
        result = get_result(session_id)

        # Return if completed or failed
        return result if result['approved'] == true || result['approved'] == false

        # Check timeout
        if Time.now - start_time > max_wait_seconds
          raise WalletGateError.new(
            "Polling timeout after #{max_wait_seconds} seconds",
            'POLLING_TIMEOUT'
          )
        end

        sleep poll_interval
      rescue WalletGateError => e
        # Re-raise non-retryable errors
        raise unless e.code == 'SESSION_PENDING'

        sleep poll_interval
      end
    end
  end

  def verify_webhook(payload, signature, secret, timestamp)
    raise ArgumentError, 'All webhook parameters are required' if [payload, signature, secret, timestamp].any?(&:nil?)

    # Check timestamp (within 5 minutes)
    timestamp_ms = timestamp.to_i
    current_time_ms = (Time.now.to_f * 1000).to_i

    if (current_time_ms - timestamp_ms) > 300_000
      return false
    end

    # Compute expected signature
    expected = Base64.strict_encode64(
      OpenSSL::HMAC.digest('sha256', secret, payload)
    )

    # Secure comparison
    signature.bytesize == expected.bytesize &&
      OpenSSL.fixed_length_secure_compare(signature, expected)
  end

  private

  def make_request(method, path, body = nil, retries = 0)
    uri = URI("#{@base_url}#{path}")
    http = Net::HTTP.new(uri.host, uri.port)
    http.use_ssl = uri.scheme == 'https'
    http.read_timeout = @timeout
    http.open_timeout = @timeout

    request = case method
              when :get
                Net::HTTP::Get.new(uri)
              when :post
                req = Net::HTTP::Post.new(uri)
                req.body = body.to_json if body
                req
              else
                raise ArgumentError, "Unsupported HTTP method: #{method}"
              end

    request['Authorization'] = "Bearer #{@api_key}"
    request['Content-Type'] = 'application/json' if body
    request['User-Agent'] = 'WalletGate-Ruby/1.0.0'

    response = http.request(request)

    case response.code.to_i
    when 200..299
      parse_json_response(response.body)
    when 429
      handle_rate_limit(response, retries, method, path, body)
    when 500..599
      handle_server_error(response, retries, method, path, body)
    else
      handle_client_error(response)
    end
  rescue Net::TimeoutError => e
    if retries < MAX_RETRIES
      sleep(calculate_retry_delay(retries))
      make_request(method, path, body, retries + 1)
    else
      raise WalletGateError.new("Request timeout after #{retries + 1} attempts", 'TIMEOUT')
    end
  rescue StandardError => e
    if retries < MAX_RETRIES && retriable_error?(e)
      sleep(calculate_retry_delay(retries))
      make_request(method, path, body, retries + 1)
    else
      raise WalletGateError.new("Network error: #{e.message}", 'NETWORK_ERROR')
    end
  end

  def parse_json_response(body)
    JSON.parse(body)
  rescue JSON::ParserError
    raise WalletGateError.new('Invalid JSON response from server', 'INVALID_RESPONSE')
  end

  def handle_rate_limit(response, retries, method, path, body)
    if retries < MAX_RETRIES
      retry_after = response['Retry-After']&.to_i || calculate_retry_delay(retries)
      sleep(retry_after)
      make_request(method, path, body, retries + 1)
    else
      error_data = parse_json_response(response.body) rescue {}
      raise WalletGateError.new(
        error_data['message'] || 'Rate limit exceeded',
        'RATE_LIMIT_EXCEEDED',
        429,
        error_data
      )
    end
  end

  def handle_server_error(response, retries, method, path, body)
    if retries < MAX_RETRIES
      sleep(calculate_retry_delay(retries))
      make_request(method, path, body, retries + 1)
    else
      error_data = parse_json_response(response.body) rescue {}
      raise WalletGateError.new(
        error_data['message'] || 'Server error',
        'SERVER_ERROR',
        response.code.to_i,
        error_data
      )
    end
  end

  def handle_client_error(response)
    error_data = parse_json_response(response.body) rescue {}
    raise WalletGateError.new(
      error_data['message'] || "HTTP #{response.code}",
      error_data['code'] || 'CLIENT_ERROR',
      response.code.to_i,
      error_data
    )
  end

  def calculate_retry_delay(attempt)
    RETRY_DELAY * (RETRY_BACKOFF ** attempt)
  end

  def retriable_error?(error)
    error.is_a?(Net::HTTPRetriableError) ||
      error.is_a?(SocketError) ||
      error.is_a?(Errno::ECONNRESET)
  end

  def validate_checks(checks)
    raise ArgumentError, 'Checks must be an array' unless checks.is_a?(Array)
    raise ArgumentError, 'At least one check is required' if checks.empty?
    raise ArgumentError, 'Maximum 10 checks allowed' if checks.length > 10

    valid_types = %w[age_over residency_eu identity_verified]

    checks.each_with_index do |check, index|
      raise ArgumentError, "Check #{index} must be a hash" unless check.is_a?(Hash)
      raise ArgumentError, "Check #{index} must have a 'type' field" unless check.key?(:type) || check.key?('type')

      type = check[:type] || check['type']
      raise ArgumentError, "Check #{index} has invalid type '#{type}'" unless valid_types.include?(type)

      if type == 'age_over'
        value = check[:value] || check['value']
        raise ArgumentError, "Check #{index} 'age_over' requires a numeric value" unless value.is_a?(Numeric)
        raise ArgumentError, "Check #{index} age must be between 0 and 150" unless value >= 0 && value <= 150
      end
    end
  end

  def validate_url(url, field_name)
    uri = URI.parse(url)
    raise ArgumentError, "#{field_name} must be a valid HTTPS URL" unless uri.scheme == 'https'
  rescue URI::InvalidURIError
    raise ArgumentError, "#{field_name} must be a valid URL"
  end
end

# Usage Example with Error Handling
begin
  client = WalletGate.new(ENV['WALLETGATE_API_KEY'])

  session = client.start_verification(
    checks: [
      { type: 'age_over', value: 18 },
      { type: 'residency_eu' }
    ],
    redirect_url: 'https://myapp.com/success',
    webhook_url: 'https://myapp.com/webhook',
    metadata: { user_id: 'user_123', source: 'checkout' }
  )

  puts "Verification URL: #{session['walletRequestUrl']}"
  puts "Session ID: #{session['id']}"

  # Poll for result (alternative to webhooks)
  result = client.poll_for_result(session['id'], max_wait_seconds: 300)

  if result['approved']
    puts "Verification successful!"
    result['checks'].each do |check|
      puts "  #{check['type']}: #{check['passed'] ? 'PASS' : 'FAIL'}"
    end
  else
    puts "Verification failed"
  end

rescue WalletGateError => e
  puts "WalletGate API Error: #{e.message}"
  puts "Error Code: #{e.code}" if e.code
  puts "HTTP Status: #{e.status_code}" if e.status_code
  puts "Details: #{e.details}" if e.details
rescue ArgumentError => e
  puts "Invalid input: #{e.message}"
rescue StandardError => e
  puts "Unexpected error: #{e.message}"
end

# Usage
client = WalletGate.new(ENV['WALLETGATE_API_KEY'])

session = client.start_verification(
  checks: [
    { type: 'age_over', value: 18 },
    { type: 'residency_eu' }
  ],
  redirect_url: 'https://myapp.com/success',
  webhook_url: 'https://myapp.com/webhook'
)

puts "Verification URL: #{session['walletRequestUrl']}"
```

### PHP

```php
<?php

class WalletGate {
    private $apiKey;
    private $baseUrl;

    public function __construct($apiKey, $baseUrl = 'https://api.walletgate.app') {
        $this->apiKey = $apiKey;
        $this->baseUrl = $baseUrl;
    }

    public function startVerification($checks, $redirectUrl = null, $webhookUrl = null, $metadata = []) {
        $data = ['checks' => $checks];

        if ($redirectUrl) $data['redirectUrl'] = $redirectUrl;
        if ($webhookUrl) $data['webhookUrl'] = $webhookUrl;
        if (!empty($metadata)) $data['metadata'] = $metadata;

        $options = [
            'http' => [
                'header' => [
                    "Authorization: Bearer {$this->apiKey}",
                    "Content-Type: application/json"
                ],
                'method' => 'POST',
                'content' => json_encode($data)
            ]
        ];

        $response = file_get_contents(
            "{$this->baseUrl}/v1/verify/sessions",
            false,
            stream_context_create($options)
        );

        if ($response === false) {
            throw new Exception('API request failed');
        }

        return json_decode($response, true);
    }

    public function getResult($sessionId) {
        $options = [
            'http' => [
                'header' => [
                    "Authorization: Bearer {$this->apiKey}"
                ],
                'method' => 'GET'
            ]
        ];

        $response = file_get_contents(
            "{$this->baseUrl}/v1/verify/sessions/{$sessionId}",
            false,
            stream_context_create($options)
        );

        if ($response === false) {
            throw new Exception('API request failed');
        }

        return json_decode($response, true);
    }
}

// Usage
$client = new WalletGate($_ENV['WALLETGATE_API_KEY']);

$session = $client->startVerification([
    ['type' => 'age_over', 'value' => 18],
    ['type' => 'residency_eu']
], 'https://myapp.com/success', 'https://myapp.com/webhook');

echo "Verification URL: " . $session['walletRequestUrl'] . "\n";
?>
```

### Java

```java
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.net.URI;
import java.time.Duration;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.JsonNode;

public class WalletGate {
    private final String apiKey;
    private final String baseUrl;
    private final HttpClient httpClient;
    private final ObjectMapper objectMapper;

    public WalletGate(String apiKey, String baseUrl) {
        this.apiKey = apiKey;
        this.baseUrl = baseUrl != null ? baseUrl : "https://api.walletgate.app";
        this.httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(30))
            .build();
        this.objectMapper = new ObjectMapper();
    }

    public JsonNode startVerification(Object[] checks, String redirectUrl, String webhookUrl, Object metadata)
            throws Exception {

        var requestBody = objectMapper.createObjectNode();
        requestBody.set("checks", objectMapper.valueToTree(checks));

        if (redirectUrl != null) requestBody.put("redirectUrl", redirectUrl);
        if (webhookUrl != null) requestBody.put("webhookUrl", webhookUrl);
        if (metadata != null) requestBody.set("metadata", objectMapper.valueToTree(metadata));

        HttpRequest request = HttpRequest.newBuilder()
            .uri(URI.create(baseUrl + "/v1/verify/sessions"))
            .timeout(Duration.ofSeconds(30))
            .header("Authorization", "Bearer " + apiKey)
            .header("Content-Type", "application/json")
            .POST(HttpRequest.BodyPublishers.ofString(requestBody.toString()))
            .build();

        HttpResponse<String> response = httpClient.send(request,
            HttpResponse.BodyHandlers.ofString());

        if (response.statusCode() != 200) {
            throw new RuntimeException("API Error: " + response.statusCode() + " - " + response.body());
        }

        return objectMapper.readTree(response.body());
    }

    public JsonNode getResult(String sessionId) throws Exception {
        HttpRequest request = HttpRequest.newBuilder()
            .uri(URI.create(baseUrl + "/v1/verify/sessions/" + sessionId))
            .timeout(Duration.ofSeconds(30))
            .header("Authorization", "Bearer " + apiKey)
            .GET()
            .build();

        HttpResponse<String> response = httpClient.send(request,
            HttpResponse.BodyHandlers.ofString());

        if (response.statusCode() != 200) {
            throw new RuntimeException("API Error: " + response.statusCode() + " - " + response.body());
        }

        return objectMapper.readTree(response.body());
    }
}

// Usage
var client = new WalletGate(System.getenv("WALLETGATE_API_KEY"), null);

var checks = new Object[] {
    Map.of("type", "age_over", "value", 18),
    Map.of("type", "residency_eu")
};

JsonNode session = client.startVerification(
    checks,
    "https://myapp.com/success",
    "https://myapp.com/webhook",
    null
);

System.out.println("Verification URL: " + session.get("walletRequestUrl").asText());
```

### Python

```python
import requests
import json
from typing import List, Dict, Any, Optional

class WalletGate:
    def __init__(self, api_key: str, base_url: str = "https://api.walletgate.app"):
        self.api_key = api_key
        self.base_url = base_url
        self.session = requests.Session()
        self.session.headers.update({
            'Authorization': f'Bearer {api_key}',
            'Content-Type': 'application/json'
        })

    def start_verification(
        self,
        checks: List[Dict[str, Any]],
        redirect_url: Optional[str] = None,
        webhook_url: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:

        data = {"checks": checks}

        if redirect_url:
            data["redirectUrl"] = redirect_url
        if webhook_url:
            data["webhookUrl"] = webhook_url
        if metadata:
            data["metadata"] = metadata

        response = self.session.post(
            f"{self.base_url}/v1/verify/sessions",
            json=data,
            timeout=30
        )

        if response.status_code != 200:
            raise Exception(f"API Error: {response.status_code} - {response.text}")

        return response.json()

    def get_result(self, session_id: str) -> Dict[str, Any]:
        response = self.session.get(
            f"{self.base_url}/v1/verify/sessions/{session_id}",
            timeout=30
        )

        if response.status_code != 200:
            raise Exception(f"API Error: {response.status_code} - {response.text}")

        return response.json()

# Usage
import os

client = WalletGate(os.getenv('WALLETGATE_API_KEY'))

session = client.start_verification(
    checks=[
        {"type": "age_over", "value": 18},
        {"type": "residency_eu"}
    ],
    redirect_url="https://myapp.com/success",
    webhook_url="https://myapp.com/webhook"
)

print(f"Verification URL: {session['walletRequestUrl']}")
```

### Go

```go
package main

import (
    "bytes"
    "encoding/json"
    "fmt"
    "io"
    "net/http"
    "time"
)

type WalletGate struct {
    apiKey  string
    baseURL string
    client  *http.Client
}

type VerificationCheck struct {
    Type  string      `json:"type"`
    Value interface{} `json:"value,omitempty"`
}

type StartVerificationRequest struct {
    Checks      []VerificationCheck    `json:"checks"`
    RedirectURL string                 `json:"redirectUrl,omitempty"`
    WebhookURL  string                 `json:"webhookUrl,omitempty"`
    Metadata    map[string]interface{} `json:"metadata,omitempty"`
}

func NewWalletGate(apiKey string, baseURL ...string) *WalletGate {
    url := "https://api.walletgate.app"
    if len(baseURL) > 0 {
        url = baseURL[0]
    }

    return &WalletGate{
        apiKey:  apiKey,
        baseURL: url,
        client:  &http.Client{Timeout: 30 * time.Second},
    }
}

func (w *WalletGate) StartVerification(req StartVerificationRequest) (map[string]interface{}, error) {
    jsonData, err := json.Marshal(req)
    if err != nil {
        return nil, err
    }

    httpReq, err := http.NewRequest("POST", w.baseURL+"/v1/verify/sessions", bytes.NewBuffer(jsonData))
    if err != nil {
        return nil, err
    }

    httpReq.Header.Set("Authorization", "Bearer "+w.apiKey)
    httpReq.Header.Set("Content-Type", "application/json")

    resp, err := w.client.Do(httpReq)
    if err != nil {
        return nil, err
    }
    defer resp.Body.Close()

    body, err := io.ReadAll(resp.Body)
    if err != nil {
        return nil, err
    }

    if resp.StatusCode != 200 {
        return nil, fmt.Errorf("API Error: %d - %s", resp.StatusCode, string(body))
    }

    var result map[string]interface{}
    err = json.Unmarshal(body, &result)
    return result, err
}

func (w *WalletGate) GetResult(sessionID string) (map[string]interface{}, error) {
    req, err := http.NewRequest("GET", w.baseURL+"/v1/verify/sessions/"+sessionID, nil)
    if err != nil {
        return nil, err
    }

    req.Header.Set("Authorization", "Bearer "+w.apiKey)

    resp, err := w.client.Do(req)
    if err != nil {
        return nil, err
    }
    defer resp.Body.Close()

    body, err := io.ReadAll(resp.Body)
    if err != nil {
        return nil, err
    }

    if resp.StatusCode != 200 {
        return nil, fmt.Errorf("API Error: %d - %s", resp.StatusCode, string(body))
    }

    var result map[string]interface{}
    err = json.Unmarshal(body, &result)
    return result, err
}

// Usage
func main() {
    client := NewWalletGate(os.Getenv("WALLETGATE_API_KEY"))

    session, err := client.StartVerification(StartVerificationRequest{
        Checks: []VerificationCheck{
            {Type: "age_over", Value: 18},
            {Type: "residency_eu"},
        },
        RedirectURL: "https://myapp.com/success",
        WebhookURL:  "https://myapp.com/webhook",
    })

    if err != nil {
        panic(err)
    }

    fmt.Printf("Verification URL: %s\n", session["walletRequestUrl"])
}
```

## Error Handling

### HTTP Status Codes

- **200 OK** - Request successful
- **400 Bad Request** - Invalid request format
- **401 Unauthorized** - Invalid or missing API key
- **429 Too Many Requests** - Rate limit exceeded
- **500 Internal Server Error** - Server error

### Error Response Format

```json
{
  "code": "INVALID_REQUEST",
  "message": "Invalid check type specified",
  "details": {
    "field": "checks[0].type",
    "value": "invalid_check_type"
  },
  "timestamp": "2025-09-25T18:30:00Z",
  "requestId": "req_abc123"
}
```

## Webhook Verification

When you receive webhook notifications, verify the signature to ensure authenticity:

### Webhook Headers

```http
X-WalletGate-Signature: base64_encoded_signature
X-WalletGate-Timestamp: 1695661800000
```

### Signature Verification (HMAC-SHA256)

```ruby
# Ruby
require 'openssl'
require 'base64'

def verify_webhook(payload, signature, secret, timestamp)
  # Check timestamp (within 5 minutes)
  return false if (Time.now.to_i * 1000 - timestamp.to_i) > 300_000

  # Compute expected signature
  expected = Base64.strict_encode64(
    OpenSSL::HMAC.digest('sha256', secret, payload)
  )

  # Compare signatures
  ActiveSupport::SecurityUtils.secure_compare(signature, expected)
end
```

```php
// PHP
function verifyWebhook($payload, $signature, $secret, $timestamp) {
    // Check timestamp (within 5 minutes)
    if ((time() * 1000 - intval($timestamp)) > 300000) {
        return false;
    }

    // Compute expected signature
    $expected = base64_encode(hash_hmac('sha256', $payload, $secret, true));

    // Compare signatures
    return hash_equals($signature, $expected);
}
```

## Rate Limits

### Trial Plan (Free)
- **Unlimited test verifications** + 0 live verifications/month
- **No rate limits** (reasonable use)

### Paid Tiers
- **Starter (€29/month):** Unlimited test + 150 live verifications/month
- **Growth (€79/month):** Unlimited test + 500 live verifications/month
- **Scale (€149/month):** Unlimited test + 2,000 live verifications/month
- **Enterprise:** Custom pricing, unlimited

### Rate Limit Headers

When approaching limits, responses include:

```http
X-RateLimit-Limit: 10000
X-RateLimit-Remaining: 9950
X-RateLimit-Reset: 1698796800
```

## Testing

Use the test wallet for development:

1. **Create verification session** with your API key
2. **Open `walletRequestUrl`** in browser
3. **Select test persona** (Maria 18+ Spain, John 30 USA, etc.)
4. **Complete verification** and see results

This allows testing without real EUDI wallet apps during development.