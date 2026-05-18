import { createFileRoute } from '@tanstack/react-router';

import ProjectChatScreen from '@/containers/screens/projects/ProjectChatScreen';
import { getAppBaseUrl } from '@/lib/config/base-urls';
import { projectQueryOptions } from '@/lib/data/keys/projects';
import { rlog } from '@/lib/utils/dev-logger';
import type { GetProjectResponse } from '@/services/api';

export const Route = createFileRoute('/_protected/chat/projects/$projectId/new')({
  component: ProjectChatRoute,

  loader: async ({ params, context }) => {
    const { queryClient } = context;

    if (!params.projectId) {
      return { project: null, projectName: null };
    }

    const options = projectQueryOptions(params.projectId);

    try {
      await queryClient.ensureQueryData(options);
    } catch (error) {
      rlog.stuck('project-chat-loader', `error: ${error instanceof Error ? error.message : String(error)}`);
      return { project: null, projectName: null };
    }

    const cachedData = queryClient.getQueryData<GetProjectResponse>(options.queryKey);
    const project = cachedData?.success ? cachedData.data : null;

    return {
      project,
      projectName: project?.name ?? null,
    };
  },

  head: ({ loaderData }) => {
    const siteUrl = getAppBaseUrl();
    const displayTitle = loaderData?.projectName
      ? `New Chat - ${loaderData.projectName} - DebateKit`
      : 'New Chat - DebateKit';

    return {
      meta: [
        { title: displayTitle },
        { name: 'robots', content: 'noindex, nofollow' },
      ],
      links: [
        { rel: 'canonical', href: `${siteUrl}/chat` },
      ],
    };
  },

  staleTime: 0,
});

function ProjectChatRoute() {
  const { projectId } = Route.useParams();
  const loaderData = Route.useLoaderData();

  return (
    <div className="flex flex-col flex-1">
      <ProjectChatScreen
        projectId={projectId}
        project={loaderData?.project ?? null}
      />
    </div>
  );
}
