import ejs from "ejs";
import fs from "fs";
import path from "path";
import { TerraformEC2Resource, TerraformS3Resource, TerraformSecurityGroupResource, TerraformVPCResource, TerraformSubnetResource, TerraformIGWResource, TerraformRouteTableResource, TerraformECSClusterResource, TerraformECSServiceResource, TerraformECSTaskDefinitionResource, TerraformALBResource, TerraformALBListenerResource, TerraformALBTargetGroupResource } from "./resourceMapper";

const resourceTemplates = [
  { key: "ec2", file: "main/main.ec2.tf.ejs" },
  { key: "s3", file: "main/main.s3.tf.ejs" },
  { key: "securityGroups", file: "main/main.securityGroup.tf.ejs" },
  { key: "vpcs", file: "main/main.vpc.tf.ejs" },
  { key: "subnets", file: "main/main.subnet.tf.ejs" },
  { key: "igws", file: "main/main.igw.tf.ejs" },
  { key: "routeTables", file: "main/main.routeTable.tf.ejs" },
  { key: "ecsClusters", file: "main/main.ecsCluster.tf.ejs" },
  { key: "ecsServices", file: "main/main.ecsService.tf.ejs" },
  { key: "ecsTaskDefs", file: "main/main.ecsTaskDef.tf.ejs" },
  { key: "albs", file: "main/main.alb.tf.ejs" },
  { key: "albListeners", file: "main/main.albListener.tf.ejs" },
  { key: "albTargetGroups", file: "main/main.albTargetGroup.tf.ejs" },
];

// Function to make resourceName unique in a resource array
function makeResourceNamesUnique<T extends { resourceName: string }>(resources: T[]): T[] {
  const nameCount: Record<string, number> = {};
  return resources.map((res) => {
    let base = res.resourceName;
    if (!base) base = 'resource';
    if (nameCount[base] === undefined) {
      nameCount[base] = 0;
    } else {
      nameCount[base] += 1;
    }
    const uniqueName = nameCount[base] === 0 ? base : `${base}_${nameCount[base]}`;
    return { ...res, resourceName: uniqueName };
  });
}

// Function for global uniqueness of names (variables/outputs)
function makeNameGloballyUnique(base: string, used: Set<string>): string {
  let name = base;
  let i = 1;
  while (used.has(name)) {
    name = `${base}_${i}`;
    i++;
  }
  used.add(name);
  return name;
}

export async function generateTerraform(
  ec2: TerraformEC2Resource[],
  s3: TerraformS3Resource[],
  securityGroups: TerraformSecurityGroupResource[],
  vpcs: TerraformVPCResource[],
  subnets: TerraformSubnetResource[],
  igws: TerraformIGWResource[],
  routeTables: TerraformRouteTableResource[],
  ecsClusters: TerraformECSClusterResource[],
  ecsServices: TerraformECSServiceResource[],
  ecsTaskDefs: TerraformECSTaskDefinitionResource[],
  albs: TerraformALBResource[] = [],
  albListeners: TerraformALBListenerResource[] = [],
  albTargetGroups: TerraformALBTargetGroupResource[] = [],
  importedVariableNames: string[] = [],
  importedOutputNames: string[] = [],
  outputPath: string = "terraform/main.tf"
): Promise<void> {
  // Make resource names unique
  ec2 = makeResourceNamesUnique(ec2);
  s3 = makeResourceNamesUnique(s3);
  securityGroups = makeResourceNamesUnique(securityGroups);
  vpcs = makeResourceNamesUnique(vpcs);
  subnets = makeResourceNamesUnique(subnets);
  igws = makeResourceNamesUnique(igws);
  routeTables = makeResourceNamesUnique(routeTables);
  ecsClusters = makeResourceNamesUnique(ecsClusters);
  ecsServices = makeResourceNamesUnique(ecsServices);
  ecsTaskDefs = makeResourceNamesUnique(ecsTaskDefs);
  albs = makeResourceNamesUnique(albs);
  albListeners = makeResourceNamesUnique(albListeners);
  albTargetGroups = makeResourceNamesUnique(albTargetGroups);
  const allData: Record<string, any> = { ec2, s3, securityGroups, vpcs, subnets, igws, routeTables, ecsClusters, ecsServices, ecsTaskDefs, albs, albListeners, albTargetGroups };
  let mainTf = "";
  for (const { key, file } of resourceTemplates) {
    if (allData[key] && allData[key].length) {
      const templatePath = path.join(__dirname, "../templates/" + file);
      const template = fs.readFileSync(templatePath, "utf-8");
      mainTf += ejs.render(template, allData) + "\n";
    }
  }
  fs.writeFileSync(outputPath, mainTf);
  console.log(`Terraform file generated: ${outputPath}`);
}

// Generate provider.tf from EJS template
export async function generateProviderTf(
  outputPath: string = "terraform/provider.tf"
): Promise<void> {
  const templatePath = path.join(__dirname, "../templates/common/provider.tf.ejs");
  const template = fs.readFileSync(templatePath, "utf-8");
  const rendered = ejs.render(template, {});
  fs.writeFileSync(outputPath, rendered);
  console.log(`Terraform file generated: ${outputPath}`);
}

// Generate variables.tf from EJS template
export async function generateVariablesTf(
  ec2: TerraformEC2Resource[],
  s3: TerraformS3Resource[],
  securityGroups: TerraformSecurityGroupResource[],
  vpcs: TerraformVPCResource[],
  subnets: TerraformSubnetResource[],
  igws: TerraformIGWResource[],
  routeTables: TerraformRouteTableResource[],
  ecsClusters: TerraformECSClusterResource[],
  ecsServices: TerraformECSServiceResource[],
  ecsTaskDefs: TerraformECSTaskDefinitionResource[],
  albs: TerraformALBResource[] = [],
  albListeners: TerraformALBListenerResource[] = [],
  albTargetGroups: TerraformALBTargetGroupResource[] = [],
  importedVariableNames: string[] = []
): Promise<void> {
  // Only write global variables to variables.tf
  const globalVars = `variable "aws_region" {
  description = "AWS region to deploy resources"
  type        = string
  default     = "us-east-1"
}

variable "aws_profile" {
  description = "AWS CLI profile to use"
  type        = string
  default     = "default"
}
`;
  fs.writeFileSync("terraform/variables.tf", globalVars);

  // EC2
  const ec2WithUniqueVars = ec2.map(inst => {
    const uniqueVarNames: Record<string, string> = {};
    if ('ami' in inst && inst.ami) uniqueVarNames.ami = makeNameGloballyUnique(`${inst.resourceName}_ami`, new Set(importedVariableNames));
    if ('instanceType' in inst && inst.instanceType) uniqueVarNames.instance_type = makeNameGloballyUnique(`${inst.resourceName}_instance_type`, new Set(importedVariableNames));
    if ('subnetId' in inst && inst.subnetId) uniqueVarNames.subnet_id = makeNameGloballyUnique(`${inst.resourceName}_subnet_id`, new Set(importedVariableNames));
    if ('vpcId' in inst && inst.vpcId) uniqueVarNames.vpc_id = makeNameGloballyUnique(`${inst.resourceName}_vpc_id`, new Set(importedVariableNames));
    return { ...inst, uniqueVarNames };
  });
  // VPC
  const vpcsWithUniqueVars = vpcs.map(vpc => {
    const uniqueVarNames: Record<string, string> = {};
    if ('cidrBlock' in vpc && vpc.cidrBlock) uniqueVarNames.cidr_block = makeNameGloballyUnique(`${vpc.resourceName}_cidr_block`, new Set(importedVariableNames));
    return { ...vpc, uniqueVarNames };
  });
  // Subnet
  const subnetsWithUniqueVars = subnets.map(subnet => {
    const uniqueVarNames: Record<string, string> = {};
    if ('cidrBlock' in subnet && subnet.cidrBlock) uniqueVarNames.cidr_block = makeNameGloballyUnique(`${subnet.resourceName}_cidr_block`, new Set(importedVariableNames));
    if ('availabilityZone' in subnet && subnet.availabilityZone) uniqueVarNames.availability_zone = makeNameGloballyUnique(`${subnet.resourceName}_availability_zone`, new Set(importedVariableNames));
    if ('vpcId' in subnet && subnet.vpcId) uniqueVarNames.vpc_id = makeNameGloballyUnique(`${subnet.resourceName}_vpc_id`, new Set(importedVariableNames));
    return { ...subnet, uniqueVarNames };
  });
  // IGW
  const igwsWithUniqueVars = igws.map(igw => {
    const uniqueVarNames: Record<string, string> = {};
    if ('vpcId' in igw && igw.vpcId) uniqueVarNames.vpc_id = makeNameGloballyUnique(`${igw.resourceName}_vpc_id`, new Set(importedVariableNames));
    return { ...igw, uniqueVarNames };
  });
  // RouteTable
  const routeTablesWithUniqueVars = routeTables.map(rt => {
    const uniqueVarNames: Record<string, string> = {};
    if ('vpcId' in rt && rt.vpcId) uniqueVarNames.vpc_id = makeNameGloballyUnique(`${rt.resourceName}_vpc_id`, new Set(importedVariableNames));
    return { ...rt, uniqueVarNames };
  });
  // S3
  const s3WithUniqueVars = s3.map(bucket => {
    const uniqueVarNames: Record<string, string> = {};
    if ('bucket' in bucket && bucket.bucket) uniqueVarNames.bucket = makeNameGloballyUnique(`${bucket.resourceName}_bucket`, new Set(importedVariableNames));
    return { ...bucket, uniqueVarNames };
  });
  // ECSCluster
  const ecsClustersWithUniqueVars = ecsClusters.map(cluster => {
    const uniqueVarNames: Record<string, string> = {};
    if ('clusterArn' in cluster && cluster.clusterArn) uniqueVarNames.cluster_arn = makeNameGloballyUnique(`${cluster.resourceName}_cluster_arn`, new Set(importedVariableNames));
    return { ...cluster, uniqueVarNames };
  });
  // ECSService
  const ecsServicesWithUniqueVars = ecsServices.map(service => {
    const uniqueVarNames: Record<string, string> = {};
    if ('serviceArn' in service && service.serviceArn) uniqueVarNames.service_arn = makeNameGloballyUnique(`${service.resourceName}_service_arn`, new Set(importedVariableNames));
    if ('clusterArn' in service && service.clusterArn) uniqueVarNames.cluster_arn = makeNameGloballyUnique(`${service.resourceName}_cluster_arn`, new Set(importedVariableNames));
    return { ...service, uniqueVarNames };
  });
  // ECSTaskDef
  const ecsTaskDefsWithUniqueVars = ecsTaskDefs.map(def => {
    const uniqueVarNames: Record<string, string> = {};
    // Получаем revision из ARN (последняя часть после ':')
    const revision = def.taskDefinitionArn ? def.taskDefinitionArn.split(':').pop() : undefined;
    const baseName = `${def.resourceName}${revision ? `_${revision}` : ''}`;
    if ('taskDefinitionArn' in def && def.taskDefinitionArn) uniqueVarNames.taskdef_arn = makeNameGloballyUnique(`${baseName}_taskdef_arn`, new Set(importedVariableNames));
    if ('family' in def && def.family) uniqueVarNames.family = makeNameGloballyUnique(`${baseName}_family`, new Set(importedVariableNames));
    if ('cpu' in def && def.cpu) uniqueVarNames.cpu = makeNameGloballyUnique(`${baseName}_cpu`, new Set(importedVariableNames));
    if ('memory' in def && def.memory) uniqueVarNames.memory = makeNameGloballyUnique(`${baseName}_memory`, new Set(importedVariableNames));
    if ('networkMode' in def && def.networkMode) uniqueVarNames.network_mode = makeNameGloballyUnique(`${baseName}_network_mode`, new Set(importedVariableNames));
    uniqueVarNames.tags = makeNameGloballyUnique(`${baseName}_tags`, new Set(importedVariableNames));
    return { ...def, uniqueVarNames, revision };
  });
  // ALB
  const albsWithUniqueVars = albs.map(alb => {
    const uniqueVarNames: Record<string, string> = {};
    if ('loadBalancerArn' in alb && alb.loadBalancerArn) uniqueVarNames.lb_arn = makeNameGloballyUnique(`${alb.resourceName}_lb_arn`, new Set(importedVariableNames));
    return { ...alb, uniqueVarNames };
  });
  // ALBListener
  const albListenersWithUniqueVars = albListeners.map(listener => {
    const uniqueVarNames: Record<string, string> = {};
    if ('listenerArn' in listener && listener.listenerArn) uniqueVarNames.listener_arn = makeNameGloballyUnique(`${listener.resourceName}_listener_arn`, new Set(importedVariableNames));
    return { ...listener, uniqueVarNames };
  });
  // ALBTargetGroup
  const albTargetGroupsWithUniqueVars = albTargetGroups.map(tg => {
    const uniqueVarNames: Record<string, string> = {};
    if ('targetGroupArn' in tg && tg.targetGroupArn) uniqueVarNames.tg_arn = makeNameGloballyUnique(`${tg.resourceName}_tg_arn`, new Set(importedVariableNames));
    return { ...tg, uniqueVarNames };
  });

  // Pass arrays with unique names to templates
  // (example for securityGroups is already implemented above)
  // Other templates need to be updated similarly

  // EC2
  const ec2VarsTemplatePath = path.join(__dirname, "../templates/variables/variables_ec2.tf.ejs");
  const ec2VarsTemplate = fs.readFileSync(ec2VarsTemplatePath, "utf-8");
  const ec2VarsRendered = ejs.render(ec2VarsTemplate, { ec2: ec2WithUniqueVars });
  fs.writeFileSync("terraform/variables_ec2.tf", ec2VarsRendered);

  // VPC
  const vpcVarsTemplatePath = path.join(__dirname, "../templates/variables/variables_vpc.tf.ejs");
  const vpcVarsTemplate = fs.readFileSync(vpcVarsTemplatePath, "utf-8");
  const vpcVarsRendered = ejs.render(vpcVarsTemplate, { vpcs: vpcsWithUniqueVars });
  fs.writeFileSync("terraform/variables_vpc.tf", vpcVarsRendered);

  // Subnet
  const subnetVarsTemplatePath = path.join(__dirname, "../templates/variables/variables_subnet.tf.ejs");
  const subnetVarsTemplate = fs.readFileSync(subnetVarsTemplatePath, "utf-8");
  const subnetVarsRendered = ejs.render(subnetVarsTemplate, { subnets: subnetsWithUniqueVars });
  fs.writeFileSync("terraform/variables_subnet.tf", subnetVarsRendered);

  // IGW
  const igwVarsTemplatePath = path.join(__dirname, "../templates/variables/variables_igw.tf.ejs");
  const igwVarsTemplate = fs.readFileSync(igwVarsTemplatePath, "utf-8");
  const igwVarsRendered = ejs.render(igwVarsTemplate, { igws: igwsWithUniqueVars });
  fs.writeFileSync("terraform/variables_igw.tf", igwVarsRendered);

  // RouteTable
  const routeTableVarsTemplatePath = path.join(__dirname, "../templates/variables/variables_routeTable.tf.ejs");
  const routeTableVarsTemplate = fs.readFileSync(routeTableVarsTemplatePath, "utf-8");
  const routeTableVarsRendered = ejs.render(routeTableVarsTemplate, { routeTables: routeTablesWithUniqueVars });
  fs.writeFileSync("terraform/variables_routeTable.tf", routeTableVarsRendered);

  // S3
  const s3VarsTemplatePath = path.join(__dirname, "../templates/variables/variables_s3.tf.ejs");
  const s3VarsTemplate = fs.readFileSync(s3VarsTemplatePath, "utf-8");
  const s3VarsRendered = ejs.render(s3VarsTemplate, { s3: s3WithUniqueVars });
  fs.writeFileSync("terraform/variables_s3.tf", s3VarsRendered);

  // ECS Cluster
  const ecsClusterVarsTemplatePath = path.join(__dirname, "../templates/variables/variables_ecsCluster.tf.ejs");
  const ecsClusterVarsTemplate = fs.readFileSync(ecsClusterVarsTemplatePath, "utf-8");
  const ecsClusterVarsRendered = ejs.render(ecsClusterVarsTemplate, { ecsClusters: ecsClustersWithUniqueVars });
  fs.writeFileSync("terraform/variables_ecsCluster.tf", ecsClusterVarsRendered);

  // ECS Service
  const ecsServiceVarsTemplatePath = path.join(__dirname, "../templates/variables/variables_ecsService.tf.ejs");
  const ecsServiceVarsTemplate = fs.readFileSync(ecsServiceVarsTemplatePath, "utf-8");
  const ecsServiceVarsRendered = ejs.render(ecsServiceVarsTemplate, { ecsServices: ecsServicesWithUniqueVars });
  fs.writeFileSync("terraform/variables_ecsService.tf", ecsServiceVarsRendered);

  // ECS TaskDef
  const ecsTaskDefVarsTemplatePath = path.join(__dirname, "../templates/variables/variables_ecsTaskDef.tf.ejs");
  const ecsTaskDefVarsTemplate = fs.readFileSync(ecsTaskDefVarsTemplatePath, "utf-8");
  const ecsTaskDefVarsRendered = ejs.render(ecsTaskDefVarsTemplate, { ecsTaskDefs: ecsTaskDefsWithUniqueVars });
  fs.writeFileSync("terraform/variables_ecsTaskDef.tf", ecsTaskDefVarsRendered);

  // ALB
  const albVarsTemplatePath = path.join(__dirname, "../templates/variables/variables_alb.tf.ejs");
  const albVarsTemplate = fs.readFileSync(albVarsTemplatePath, "utf-8");
  const albVarsRendered = ejs.render(albVarsTemplate, { albs: albsWithUniqueVars });
  fs.writeFileSync("terraform/variables_alb.tf", albVarsRendered);

  // ALB Target Group
  const albTargetGroupVarsTemplatePath = path.join(__dirname, "../templates/variables/variables_albTargetGroup.tf.ejs");
  const albTargetGroupVarsTemplate = fs.readFileSync(albTargetGroupVarsTemplatePath, "utf-8");
  const albTargetGroupVarsRendered = ejs.render(albTargetGroupVarsTemplate, { albTargetGroups: albTargetGroupsWithUniqueVars });
  fs.writeFileSync("terraform/variables_albTargetGroup.tf", albTargetGroupVarsRendered);

  // ALB Listener
  const albListenerVarsTemplatePath = path.join(__dirname, "../templates/variables/variables_albListener.tf.ejs");
  const albListenerVarsTemplate = fs.readFileSync(albListenerVarsTemplatePath, "utf-8");
  const albListenerVarsRendered = ejs.render(albListenerVarsTemplate, { albListeners: albListenersWithUniqueVars });
  fs.writeFileSync("terraform/variables_albListener.tf", albListenerVarsRendered);

  // Main variables.tf (if needed)
  // const variablesTfTemplatePath = path.join(__dirname, "../templates/variables/variables.tf.ejs");
  // let allVariables: { name: string, default?: string }[] = [];
  // if (fs.existsSync(variablesTfTemplatePath)) {
  //   const variablesTfTemplate = fs.readFileSync(variablesTfTemplatePath, "utf-8");
  //   const variablesTfRendered = ejs.render(variablesTfTemplate, { ec2, s3, securityGroups, vpcs, subnets, igws, routeTables });
  //   fs.writeFileSync("terraform/variables.tf", variablesTfRendered);
  //   // Try to extract variable names from the template (or from data)
  //   // For simplicity: if the template contains <% variables.forEach ... %>, pass the variables array
  //   // Otherwise, collect manually (or leave empty)
  //   // Here we assume variables are defined in variablesTfRendered as: variable "name" { ... default = "value" ... }
  //   // If no variables found — do not generate tfvars
  //   const varRegex = /variable\s+"([^"]+)"[^{]*{[^}]*default\s*=\s*"([^"]*)"/g;
  //   let match;
  //   while ((match = varRegex.exec(variablesTfRendered)) !== null) {
  //     allVariables.push({ name: match[1], default: match[2] });
  //   }
  // }
  // // If no variables found — do not generate tfvars
  // if (allVariables.length > 0) {
  //   const uniqueVariables = filterDuplicateVariables(allVariables);
  //   await generateTfvarsFile(uniqueVariables);
  // }
  // console.log(`Terraform variable files generated.`);
}

// Generate outputs.tf from EJS template
export async function generateOutputsTf(
  ec2: TerraformEC2Resource[],
  s3: TerraformS3Resource[],
  securityGroups: TerraformSecurityGroupResource[],
  vpcs: TerraformVPCResource[],
  subnets: TerraformSubnetResource[],
  igws: TerraformIGWResource[],
  routeTables: TerraformRouteTableResource[],
  ecsClusters: TerraformECSClusterResource[],
  ecsServices: TerraformECSServiceResource[],
  ecsTaskDefs: TerraformECSTaskDefinitionResource[],
  albs: TerraformALBResource[] = [],
  albListeners: TerraformALBListenerResource[] = [],
  albTargetGroups: TerraformALBTargetGroupResource[] = [],
  importedOutputNames: string[] = [],
  outputPath: string = "terraform/outputs.tf"
): Promise<void> {
  // Make resource names unique
  ec2 = makeResourceNamesUnique(ec2);
  s3 = makeResourceNamesUnique(s3);
  securityGroups = makeResourceNamesUnique(securityGroups);
  vpcs = makeResourceNamesUnique(vpcs);
  subnets = makeResourceNamesUnique(subnets);
  igws = makeResourceNamesUnique(igws);
  routeTables = makeResourceNamesUnique(routeTables);
  ecsClusters = makeResourceNamesUnique(ecsClusters);
  ecsServices = makeResourceNamesUnique(ecsServices);
  ecsTaskDefs = makeResourceNamesUnique(ecsTaskDefs);
  albs = makeResourceNamesUnique(albs);
  albListeners = makeResourceNamesUnique(albListeners);
  albTargetGroups = makeResourceNamesUnique(albTargetGroups);
  // Global set for all output names (start with imported)
  const usedOutputNames = new Set(importedOutputNames);
  const templatePath = path.join(__dirname, "../templates/common/outputs.tf.ejs");
  const template = fs.readFileSync(templatePath, "utf-8");
  const rendered = ejs.render(template, { ec2, s3, securityGroups, vpcs, subnets, igws, routeTables, ecsClusters, ecsServices, ecsTaskDefs, albs, albListeners, albTargetGroups });
  fs.writeFileSync(outputPath, rendered);
  console.log(`Terraform file generated: ${outputPath}`);
}

export async function generateTfvarsFile(variables: { name: string, default?: string }[], outputPath: string = "terraform/terraform.tfvars") {
  const templatePath = path.join(__dirname, "../templates/variables/terraform.tfvars.ejs");
  const template = fs.readFileSync(templatePath, "utf-8");
  const rendered = ejs.render(template, { variables });
  fs.writeFileSync(outputPath, rendered);
  console.log(`Terraform tfvars file generated: ${outputPath}`);
}

function filterDuplicateVariables(vars: { name: string, default?: string }[]): { name: string, default?: string }[] {
  const seen = new Set<string>();
  return vars.filter(v => {
    if (seen.has(v.name)) return false;
    seen.add(v.name);
    return true;
  });
}
