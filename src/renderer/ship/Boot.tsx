import React, { useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from 'react-query'
import { Link, useParams } from 'react-router-dom'
import { send } from '../client/ipc'
import { RightArrow } from '../icons/RightArrow'
import { pierKey } from '../query-keys'
import { Layout } from '../shared/Layout'
import { MessageLogger } from '../shared/MessageLogger'
import { Spinner } from '../shared/Spinner'

export const Boot: React.FC = () => {
    const queryClient = useQueryClient()
    const { slug } = useParams<{ slug: string }>();
    const { data: ship } = useQuery(pierKey(slug), () => send('get-pier', slug))
    const { mutate, isIdle, isLoading, isSuccess } = useMutation(() => send('boot-pier', slug), {
        onSuccess: () => {
            queryClient.invalidateQueries(pierKey())
        }
    })

    useEffect(() => {
        if (!slug)
            return;

        async function boot() {
            await mutate()
        }

        boot();
    }, [slug])

    const shipType = ship?.type ? ship.type[0].toLocaleUpperCase() + ship.type.substring(1) : ''
    const title = `Booting ${shipType}`

    return (
        <Layout title={title} className="relative flex justify-center items-center min-content-area-height">            
            <section className="max-w-xl">                   
                {(isIdle || isLoading) &&
                    <>
                        <div className="flex items-center mb-12">
                            <Spinner className="h-24 w-24 mr-6" />
                            <div className="flex-1">
                                <h1 className="font-semibold">{title}...</h1>
                                {ship?.type === 'comet' && <div className="text-gray-300 dark:text-gray-600">This could take an hour, but more likely 5-10 minutes.</div>}
                                {ship?.type !== 'comet' && <div className="text-gray-300 dark:text-gray-600">This could take up to a few minutes.</div>}
                            </div>
                        </div>
                        <MessageLogger slug={ship?.slug} />
                    </>
                }
                {isSuccess &&
                    <div className="flex flex-col justify-center items-center space-y-6">
                        <div>
                            <h1 className="font-semibold">Your Ship is Ready</h1>
                            <div className="text-gray-300 dark:text-gray-600">Enjoy the Landscape</div>
                        </div>
                        <Link to={`/pier/${slug}/launch`} className="button">
                            Launch Ship into Urbit
                            <RightArrow className="ml-1 w-7 h-7" primary="fill-current text-transparent" secondary="fill-current" />
                        </Link>                            
                    </div>
                }
            </section>
        </Layout>
    )
}