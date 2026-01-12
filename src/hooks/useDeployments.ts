import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Json } from '@/integrations/supabase/types';

export type DeploymentStatus = 'draft' | 'planning' | 'ready' | 'running' | 'applied' | 'failed' | 'rolled_back';
export type DeploymentType = 'nodejs' | 'docker_compose' | 'static_site' | 'custom';
export type DeploymentStepType = 'clone_repo' | 'checkout' | 'env_write' | 'install_deps' | 'build' | 'start' | 'healthcheck' | 'expose' | 'finalize' | 'stop' | 'rollback' | 'custom';
export type DeploymentStepStatus = 'pending' | 'running' | 'applied' | 'failed' | 'skipped';
export type HealthcheckType = 'http' | 'tcp' | 'command';

export interface Deployment {
  id: string;
  app_name: string;
  repo_url: string;
  branch: string;
  deploy_type: DeploymentType;
  runner_id: string;
  infrastructure_id: string | null;
  status: DeploymentStatus;
  current_step: string | null;
  working_dir: string | null;
  config: Json;
  healthcheck_type: HealthcheckType;
  healthcheck_value: string | null;
  port: number | null;
  start_command: string | null;
  env_vars: Record<string, string>;
  expose_via_caddy: boolean;
  domain: string | null;
  rolled_back_from: string | null;
  error_message: string | null;
  created_by: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  updated_at: string;
}

export interface DeploymentStep {
  id: string;
  deployment_id: string;
  step_order: number;
  step_type: DeploymentStepType;
  step_name: string;
  command: string;
  order_id: string | null;
  status: DeploymentStepStatus;
  started_at: string | null;
  finished_at: string | null;
  error_message: string | null;
  stdout_tail: string | null;
  stderr_tail: string | null;
  exit_code: number | null;
  created_at: string;
  updated_at: string;
}

export interface CreateDeploymentInput {
  app_name: string;
  repo_url: string;
  branch: string;
  deploy_type: DeploymentType;
  runner_id: string;
  infrastructure_id?: string;
  healthcheck_type?: HealthcheckType;
  healthcheck_value?: string;
  port?: number;
  start_command?: string;
  env_vars?: Record<string, string>;
  expose_via_caddy?: boolean;
  domain?: string;
}

// Fetch all deployments
export function useDeployments() {
  return useQuery({
    queryKey: ['deployments'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('deployments')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as Deployment[];
    },
  });
}

// Fetch single deployment with steps
export function useDeployment(id: string | null) {
  return useQuery({
    queryKey: ['deployment', id],
    queryFn: async () => {
      if (!id) return null;
      
      const { data, error } = await supabase
        .from('deployments')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (error) throw error;
      return data as Deployment | null;
    },
    enabled: !!id,
  });
}

// Fetch deployment steps
export function useDeploymentSteps(deploymentId: string | null) {
  return useQuery({
    queryKey: ['deployment-steps', deploymentId],
    queryFn: async () => {
      if (!deploymentId) return [];
      
      const { data, error } = await supabase
        .from('deployment_steps')
        .select('*')
        .eq('deployment_id', deploymentId)
        .order('step_order', { ascending: true });

      if (error) throw error;
      return data as DeploymentStep[];
    },
    enabled: !!deploymentId,
    refetchInterval: (query) => {
      // Poll when deployment is running
      const steps = query.state.data;
      if (steps?.some(s => s.status === 'running')) {
        return 2000;
      }
      return false;
    },
  });
}

// Create deployment
export function useCreateDeployment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateDeploymentInput) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { data, error } = await supabase
        .from('deployments')
        .insert({
          app_name: input.app_name,
          repo_url: input.repo_url,
          branch: input.branch,
          deploy_type: input.deploy_type,
          runner_id: input.runner_id,
          infrastructure_id: input.infrastructure_id || null,
          healthcheck_type: input.healthcheck_type || 'http',
          healthcheck_value: input.healthcheck_value || null,
          port: input.port || 3000,
          start_command: input.start_command || null,
          env_vars: input.env_vars || {},
          expose_via_caddy: input.expose_via_caddy || false,
          domain: input.domain || null,
          status: 'draft',
          created_by: user?.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data as Deployment;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deployments'] });
      toast.success('Déploiement créé');
    },
    onError: (error: Error) => {
      toast.error(`Erreur: ${error.message}`);
    },
  });
}

// Update deployment
export function useUpdateDeployment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, config, env_vars, ...updates }: Partial<Omit<Deployment, 'config' | 'env_vars'>> & { 
      id: string;
      config?: Json;
      env_vars?: Json;
    }) => {
      const { data, error } = await supabase
        .from('deployments')
        .update({ ...updates, config, env_vars })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as Deployment;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['deployments'] });
      queryClient.invalidateQueries({ queryKey: ['deployment', data.id] });
    },
    onError: (error: Error) => {
      toast.error(`Erreur: ${error.message}`);
    },
  });
}

// Delete deployment
export function useDeleteDeployment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('deployments')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deployments'] });
      toast.success('Déploiement supprimé');
    },
    onError: (error: Error) => {
      toast.error(`Erreur: ${error.message}`);
    },
  });
}

// Generate deployment steps based on deploy type
export function generateDeploymentSteps(deployment: CreateDeploymentInput): Omit<DeploymentStep, 'id' | 'deployment_id' | 'order_id' | 'created_at' | 'updated_at'>[] {
  const workingDir = `/opt/ikoma/apps/${deployment.app_name}`;
  const steps: Omit<DeploymentStep, 'id' | 'deployment_id' | 'order_id' | 'created_at' | 'updated_at'>[] = [];
  let order = 1;

  // Clone repo
  steps.push({
    step_order: order++,
    step_type: 'clone_repo',
    step_name: 'Clone Repository',
    command: `rm -rf ${workingDir} && git clone --depth 1 --branch ${deployment.branch} ${deployment.repo_url} ${workingDir}`,
    status: 'pending',
    started_at: null,
    finished_at: null,
    error_message: null,
    stdout_tail: null,
    stderr_tail: null,
    exit_code: null,
  });

  // Checkout branch
  steps.push({
    step_order: order++,
    step_type: 'checkout',
    step_name: 'Checkout Branch',
    command: `cd ${workingDir} && git checkout ${deployment.branch}`,
    status: 'pending',
    started_at: null,
    finished_at: null,
    error_message: null,
    stdout_tail: null,
    stderr_tail: null,
    exit_code: null,
  });

  // Write env vars if any
  if (deployment.env_vars && Object.keys(deployment.env_vars).length > 0) {
    const envContent = Object.entries(deployment.env_vars)
      .map(([k, v]) => `${k}="${v}"`)
      .join('\n');
    steps.push({
      step_order: order++,
      step_type: 'env_write',
      step_name: 'Write Environment Variables',
      command: `cat > ${workingDir}/.env << 'ENVEOF'\n${envContent}\nENVEOF`,
      status: 'pending',
      started_at: null,
      finished_at: null,
      error_message: null,
      stdout_tail: null,
      stderr_tail: null,
      exit_code: null,
    });
  }

  // Type-specific steps
  switch (deployment.deploy_type) {
    case 'nodejs':
      steps.push({
        step_order: order++,
        step_type: 'install_deps',
        step_name: 'Install Dependencies',
        command: `cd ${workingDir} && npm ci --production 2>/dev/null || npm install --production`,
        status: 'pending',
        started_at: null,
        finished_at: null,
        error_message: null,
        stdout_tail: null,
        stderr_tail: null,
        exit_code: null,
      });

      steps.push({
        step_order: order++,
        step_type: 'build',
        step_name: 'Build Application',
        command: `cd ${workingDir} && if grep -q '"build"' package.json; then npm run build; else echo "No build script"; fi`,
        status: 'pending',
        started_at: null,
        finished_at: null,
        error_message: null,
        stdout_tail: null,
        stderr_tail: null,
        exit_code: null,
      });

      const startCmd = deployment.start_command || 'npm start';
      steps.push({
        step_order: order++,
        step_type: 'start',
        step_name: 'Start Application',
        command: `cd ${workingDir} && PORT=${deployment.port || 3000} nohup ${startCmd} > /var/log/${deployment.app_name}.log 2>&1 &`,
        status: 'pending',
        started_at: null,
        finished_at: null,
        error_message: null,
        stdout_tail: null,
        stderr_tail: null,
        exit_code: null,
      });
      break;

    case 'docker_compose':
      steps.push({
        step_order: order++,
        step_type: 'start',
        step_name: 'Start Docker Compose',
        command: `cd ${workingDir} && docker compose pull && docker compose up -d`,
        status: 'pending',
        started_at: null,
        finished_at: null,
        error_message: null,
        stdout_tail: null,
        stderr_tail: null,
        exit_code: null,
      });
      break;

    case 'static_site':
      steps.push({
        step_order: order++,
        step_type: 'start',
        step_name: 'Configure Static Server',
        command: `mkdir -p /var/www/${deployment.app_name} && cp -r ${workingDir}/* /var/www/${deployment.app_name}/`,
        status: 'pending',
        started_at: null,
        finished_at: null,
        error_message: null,
        stdout_tail: null,
        stderr_tail: null,
        exit_code: null,
      });
      break;
  }

  // Healthcheck
  const port = deployment.port || 3000;
  let healthcheckCmd = '';
  switch (deployment.healthcheck_type) {
    case 'http':
      healthcheckCmd = `sleep 5 && for i in 1 2 3 4 5; do curl -sf http://localhost:${port}${deployment.healthcheck_value || '/'} && exit 0; sleep 3; done; exit 1`;
      break;
    case 'tcp':
      healthcheckCmd = `sleep 5 && for i in 1 2 3 4 5; do nc -z localhost ${port} && exit 0; sleep 3; done; exit 1`;
      break;
    case 'command':
      healthcheckCmd = deployment.healthcheck_value || 'exit 0';
      break;
  }

  steps.push({
    step_order: order++,
    step_type: 'healthcheck',
    step_name: 'Health Check',
    command: healthcheckCmd,
    status: 'pending',
    started_at: null,
    finished_at: null,
    error_message: null,
    stdout_tail: null,
    stderr_tail: null,
    exit_code: null,
  });

  // Expose via Caddy if requested
  if (deployment.expose_via_caddy && deployment.domain) {
    steps.push({
      step_order: order++,
      step_type: 'expose',
      step_name: 'Configure Reverse Proxy',
      command: `echo '${deployment.domain} {\n  reverse_proxy localhost:${port}\n}' >> /etc/caddy/Caddyfile && caddy reload --config /etc/caddy/Caddyfile`,
      status: 'pending',
      started_at: null,
      finished_at: null,
      error_message: null,
      stdout_tail: null,
      stderr_tail: null,
      exit_code: null,
    });
  }

  // Finalize
  steps.push({
    step_order: order++,
    step_type: 'finalize',
    step_name: 'Finalize Deployment',
    command: `echo '{"status":"deployed","app":"${deployment.app_name}","port":${port},"working_dir":"${workingDir}"}'`,
    status: 'pending',
    started_at: null,
    finished_at: null,
    error_message: null,
    stdout_tail: null,
    stderr_tail: null,
    exit_code: null,
  });

  return steps;
}

// Create deployment steps
export function useCreateDeploymentSteps() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ deploymentId, steps }: { 
      deploymentId: string; 
      steps: Omit<DeploymentStep, 'id' | 'deployment_id' | 'order_id' | 'created_at' | 'updated_at'>[] 
    }) => {
      const stepsToInsert = steps.map(step => ({
        ...step,
        deployment_id: deploymentId,
      }));

      const { data, error } = await supabase
        .from('deployment_steps')
        .insert(stepsToInsert)
        .select();

      if (error) throw error;
      return data as DeploymentStep[];
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['deployment-steps', variables.deploymentId] });
    },
  });
}
