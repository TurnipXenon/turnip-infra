export const DeployerLambdaPolicyActions = [
    "application-autoscaling:Describe*",
    "application-autoscaling:PutScalingPolicy",
    "application-autoscaling:DeleteScalingPolicy",
    "application-autoscaling:RegisterScalableTarget",
    "cloudwatch:DescribeAlarms",
    "cloudwatch:PutMetricAlarm",
    "ecs:List*",
    "ecs:Describe*",
    "ecs:UpdateService",
    "iam:GetPolicy",
    "iam:GetPolicyVersion",
    "iam:GetRole",
    "iam:ListAttachedRolePolicies",
    "iam:ListRoles",
    "iam:ListGroups",
    "iam:ListUsers"
];