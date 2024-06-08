# Plan

We want this repository to be our infrastructure configuration for Turnip React.

1. Create ECR repository to host the Docker images for Turnip React
2. Create ALB + ECS on Fargate (need to expand this one because it's more complicated)
3. Create Github Action on turnip-react-infra that will deploy this automatically when merged on main
4. Create Github Action on turnip-react that will deploy this too

# Random thoughts
- Let's transfer our DNS records to Amazon
- turn off our api calls on portfolio site
- Let's create api.turnipxenon.com for api calls, and our first one is api.turnipxenon.com/deploy with specific keys
- Create a lambda that updates our ECS (https://stackoverflow.com/a/48572274/17836168)
