# Contributing to WalletGate EUDI SDK

Thank you for your interest in contributing to WalletGate! We're building open-source EU Digital Identity infrastructure, and we welcome contributions from the community.

## 🌟 Ways to Contribute

- **Bug Reports**: Found a bug? Open an issue with details
- **Feature Requests**: Have an idea? We'd love to hear it
- **Code Contributions**: Submit pull requests for fixes or features
- **Documentation**: Help improve our docs and examples
- **Testing**: Try the SDK and share your experience

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ and npm
- Git
- A WalletGate test API key (get one at https://walletgate.app)

### Setup Development Environment

```bash
# Clone the repository
git clone https://github.com/walletgate/eudi-sdk.git
cd eudi-sdk

# Install dependencies
npm install

# Run tests
npm test

# Build the SDK
npm run build
```

## 📝 Pull Request Process

1. **Fork the repository** and create a new branch from `main`
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes** following our coding standards:
   - Write clear, descriptive commit messages
   - Add tests for new functionality
   - Update documentation as needed
   - Follow existing code style (we use TypeScript)

3. **Test your changes**:
   ```bash
   npm test
   npm run build
   npm run lint
   ```

4. **Commit your changes**:
   ```bash
   git add .
   git commit -m "feat: add your feature description"
   ```

5. **Push to your fork**:
   ```bash
   git push origin feature/your-feature-name
   ```

6. **Open a Pull Request** on GitHub with:
   - Clear description of the changes
   - Link to any related issues
   - Screenshots/examples if applicable

## 🧪 Testing

- Write unit tests for new features
- Ensure all tests pass before submitting PR
- Test with both test and live API keys when applicable
- Include edge cases and error scenarios

```bash
# Run all tests
npm test

# Run tests in watch mode
npm test -- --watch

# Run tests with coverage
npm test -- --coverage
```

## 📚 Documentation

- Update README.md for user-facing changes
- Add JSDoc comments for new functions
- Include code examples for new features
- Update TypeScript types as needed

## 🐛 Bug Reports

When filing a bug report, please include:

- SDK version
- Node.js version
- Operating system
- Clear steps to reproduce
- Expected vs actual behavior
- Minimal code example
- Error messages/stack traces

## 💡 Feature Requests

For feature requests, please describe:

- The use case and problem you're solving
- Proposed solution or API design
- Alternative solutions you've considered
- Whether you're willing to implement it

## 🔒 Security Issues

**Do not open public issues for security vulnerabilities.**

Instead, email security@walletgate.app with:
- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

We'll respond within 48 hours and work with you on a fix.

## 📋 Code of Conduct

- Be respectful and inclusive
- Provide constructive feedback
- Focus on what's best for the community
- Show empathy towards others

We're building infrastructure that affects real people's digital identity. Let's make it excellent together.

## 📄 License

By contributing, you agree that your contributions will be licensed under the Apache-2.0 License.

## ❓ Questions?

- **Documentation**: https://walletgate.app/docs
- **Email**: support@walletgate.app
- **GitHub Issues**: https://github.com/walletgate/eudi-sdk/issues

Thank you for helping make EU Digital Identity verification accessible to everyone! 🇪🇺