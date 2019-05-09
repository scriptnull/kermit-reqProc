FROM drydock/u16microbase:master as build

# Prefix all image ENVs with IMAGE_ so there are no confusions.
ENV IMAGE_REQPROC_DIR /root/reqProc
ADD . $IMAGE_REQPROC_DIR
RUN cd $IMAGE_REQPROC_DIR && npm install

ENV IMAGE_EXEC_TEMPLATES_DIR /root/execTemplates
RUN mkdir -p $IMAGE_EXEC_TEMPLATES_DIR && \
    wget https://github.com/Shippable/kermit-execTemplates/archive/master.tar.gz -O /tmp/execTemplates.tar.gz && \
    tar -xzvf /tmp/execTemplates.tar.gz -C $IMAGE_EXEC_TEMPLATES_DIR --strip-components=1 && \
    rm /tmp/execTemplates.tar.gz

ENV IMAGE_REQEXEC_DIR /root/reqExec

# TODO: Pull binaries from s3 instead of building it here.
RUN mkdir -p $IMAGE_REQEXEC_DIR && \
    wget https://github.com/Shippable/kermit-reqExec/archive/master.tar.gz -O /tmp/reqExec.tar.gz && \
    mkdir -p /tmp/reqExec && tar -xzf /tmp/reqExec.tar.gz -C /tmp/reqExec --strip-components=1 && \
    cd /tmp/reqExec && package/x86_64/Ubuntu_16.04/package.sh && \
    mkdir -p $IMAGE_REQEXEC_DIR/x86_64/Ubuntu_16.04 && \
    mv /tmp/reqExec/dist $IMAGE_REQEXEC_DIR/x86_64/Ubuntu_16.04 && \
    rm -rf /tmp/reqExec

FROM drydock/distrobase:master

COPY --from=build /root/reqProc /root/reqProc
COPY --from=build /root/reqExec /root/reqExec
COPY --from=build /root/execTemplates /root/execTemplates

ENV IMAGE_REQPROC_DIR /root/reqProc
ENV IMAGE_REQEXEC_DIR /root/reqExec
ENV IMAGE_EXEC_TEMPLATES_DIR /root/execTemplates

ENTRYPOINT ["bash", "/root/reqProc/boot.sh"]
