# Plan

We want this repository to be our infrastructure configuration for Turnip React.

1. Create ECR repository to host the Docker images for Turnip React
2. Create ALB + ECS on Fargate (need to expand this one because it's more complicated)
3. Create Github Action on turnip-react-infra that will deploy this automatically when merged on main
4. Create Github Action on turnip-react that will deploy this too
